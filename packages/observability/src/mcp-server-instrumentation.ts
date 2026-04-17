/**
 * McpServer の 全ツール / プロンプト / リソース を一括で観測するヘルパ
 * Helpers that bulk-instrument every tool / prompt / resource already
 * registered on an MCP server.
 * Helper untuk menginstrumentasi semua tool / prompt / resource yang sudah
 * terdaftar pada server MCP.
 *
 * すべてのツールファイルを手で書き換える代わりに、登録完了後にこの関数を呼ぶだけで
 * 全体に observability（trace / metrics / Langfuse）が水平展開される。
 */

import { instrumentTool } from "./mcp.js";
import { getMetrics } from "./metrics.js";
import { getTracer } from "./tracer.js";
import { getObsContext, updateObsContext } from "./context.js";

type AnyHandler = (...args: unknown[]) => unknown;

interface RegisteredToolLike {
  handler: AnyHandler;
  title?: string;
  description?: string;
  inputSchema?: unknown;
}

interface RegisteredPromptLike {
  callback: AnyHandler;
  title?: string;
  description?: string;
}

interface RegisteredResourceLike {
  readCallback: AnyHandler;
  metadata?: { title?: string };
  name?: string;
}

interface RegisteredResourceTemplateLike {
  readCallback: AnyHandler;
  metadata?: { title?: string };
  resourceTemplate: { uriTemplate: { toString(): string } };
}

interface McpServerInternals {
  _registeredTools?: Record<string, RegisteredToolLike>;
  _registeredPrompts?: Record<string, RegisteredPromptLike>;
  _registeredResources?: Record<string, RegisteredResourceLike>;
  _registeredResourceTemplates?: Record<string, RegisteredResourceTemplateLike>;
}

export interface InstrumentAllOptions {
  /** 除外するツール名（例: 既に手動で instrumentTool を噛ませているもの） */
  excludeTools?: string[];
  /** 除外するプロンプト名 */
  excludePrompts?: string[];
  /** 二重ラップを防ぐマーカー */
  markerKey?: string;
}

const DEFAULT_MARKER = "__suguvisa_observability_wrapped__";

/**
 * 全ツールのハンドラを `instrumentTool` でラップし、tracing / metrics / Langfuse を有効化する。
 *
 * 同じサーバーに対して複数回呼ばれても二重ラップされない。
 */
export function instrumentAllTools(
  server: unknown,
  options: InstrumentAllOptions = {},
): { wrapped: string[]; skipped: string[] } {
  const marker = options.markerKey ?? DEFAULT_MARKER;
  const exclude = new Set(options.excludeTools ?? []);
  const tools = (server as McpServerInternals)._registeredTools ?? {};
  const wrapped: string[] = [];
  const skipped: string[] = [];
  for (const [name, reg] of Object.entries(tools)) {
    if (exclude.has(name)) {
      skipped.push(name);
      continue;
    }
    const fn = reg.handler as AnyHandler & { [k: string]: unknown };
    if (!fn || fn[marker] === true) {
      skipped.push(name);
      continue;
    }
    // SDK call shape:
    //   schema あり: handler(args, extra)
    //   schema なし: handler(extra)
    // instrumentTool は「観測したい入力」だけを扱うので、最初の引数を渡し、
    // 元の handler には全引数をそのまま中継する。
    const hasInput = reg.inputSchema !== undefined;
    const wrappedFn: AnyHandler = async (...args: unknown[]) => {
      const observableInput = hasInput ? args[0] : undefined;
      const instrumented = instrumentTool(name, async () => {
        return (fn as unknown as (...a: unknown[]) => unknown)(...args);
      });
      return (instrumented as unknown as (a: unknown) => unknown)(observableInput);
    };
    Object.defineProperty(wrappedFn, marker, { value: true, enumerable: false });
    reg.handler = wrappedFn;
    wrapped.push(name);
  }
  return { wrapped, skipped };
}

/**
 * 全プロンプトのコールバックをトレースでラップする。
 * プロンプトは LLM に流すテンプレート生成処理なので、metrics と span を張るだけに留める。
 */
export function instrumentAllPrompts(
  server: unknown,
  options: InstrumentAllOptions = {},
): { wrapped: string[]; skipped: string[] } {
  const marker = options.markerKey ?? DEFAULT_MARKER;
  const exclude = new Set(options.excludePrompts ?? []);
  const prompts = (server as McpServerInternals)._registeredPrompts ?? {};
  const wrapped: string[] = [];
  const skipped: string[] = [];
  for (const [name, reg] of Object.entries(prompts)) {
    if (exclude.has(name)) {
      skipped.push(name);
      continue;
    }
    const fn = reg.callback as AnyHandler & { [k: string]: unknown };
    if (!fn || fn[marker] === true) {
      skipped.push(name);
      continue;
    }
    const wrappedFn: AnyHandler = async (...args: unknown[]) => {
      const tracer = getTracer();
      const metrics = getMetrics();
      const start = Date.now();
      updateObsContext({ operation: `prompt.${name}` });
      try {
        const result = await tracer.startSpan(`mcp.prompt.${name}`, async (span) => {
          span.setAttribute("mcp.prompt", name);
          const ctx = getObsContext();
          if (ctx?.requestId) span.setAttribute("mcp.request_id", ctx.requestId);
          if (ctx?.tenantId) span.setAttribute("mcp.tenant_id", ctx.tenantId);
          const res = await (fn as unknown as (...a: unknown[]) => unknown)(...args);
          span.setStatus("ok");
          return res;
        });
        metrics.counter("mcp.prompt.calls", 1, { prompt: name, status: "success" });
        metrics.histogram("mcp.prompt.duration_ms", Date.now() - start, {
          prompt: name,
          status: "success",
        });
        return result;
      } catch (err) {
        metrics.counter("mcp.prompt.calls", 1, { prompt: name, status: "error" });
        metrics.histogram("mcp.prompt.duration_ms", Date.now() - start, {
          prompt: name,
          status: "error",
        });
        throw err;
      }
    };
    Object.defineProperty(wrappedFn, marker, { value: true, enumerable: false });
    reg.callback = wrappedFn;
    wrapped.push(name);
  }
  return { wrapped, skipped };
}

/**
 * 全リソース (静的 + テンプレート) の readCallback をトレースでラップする。
 */
export function instrumentAllResources(
  server: unknown,
  options: InstrumentAllOptions = {},
): { wrapped: string[]; skipped: string[] } {
  const marker = options.markerKey ?? DEFAULT_MARKER;
  const internals = server as McpServerInternals;
  const wrapped: string[] = [];
  const skipped: string[] = [];

  const entries: Array<[string, { readCallback: AnyHandler }]> = [
    ...Object.entries(internals._registeredResources ?? {}),
    ...Object.entries(internals._registeredResourceTemplates ?? {}),
  ];

  for (const [key, reg] of entries) {
    const fn = reg.readCallback as AnyHandler & { [k: string]: unknown };
    if (!fn || fn[marker] === true) {
      skipped.push(key);
      continue;
    }
    const wrappedFn: AnyHandler = async (...args: unknown[]) => {
      const tracer = getTracer();
      const metrics = getMetrics();
      const start = Date.now();
      updateObsContext({ operation: `resource.${key}` });
      try {
        const result = await tracer.startSpan(`mcp.resource.read`, async (span) => {
          span.setAttribute("mcp.resource", key);
          const ctx = getObsContext();
          if (ctx?.requestId) span.setAttribute("mcp.request_id", ctx.requestId);
          const res = await (fn as unknown as (...a: unknown[]) => unknown)(...args);
          span.setStatus("ok");
          return res;
        });
        metrics.counter("mcp.resource.reads", 1, { resource: key, status: "success" });
        metrics.histogram("mcp.resource.duration_ms", Date.now() - start, {
          resource: key,
          status: "success",
        });
        return result;
      } catch (err) {
        metrics.counter("mcp.resource.reads", 1, { resource: key, status: "error" });
        metrics.histogram("mcp.resource.duration_ms", Date.now() - start, {
          resource: key,
          status: "error",
        });
        throw err;
      }
    };
    Object.defineProperty(wrappedFn, marker, { value: true, enumerable: false });
    reg.readCallback = wrappedFn;
    wrapped.push(key);
  }
  return { wrapped, skipped };
}

/**
 * 全てを一括で観測対象にするショートカット。
 * Bulk-instrument every tool, prompt, and resource on the server.
 */
export function instrumentMcpServer(
  server: unknown,
  options: InstrumentAllOptions = {},
): {
  tools: { wrapped: string[]; skipped: string[] };
  prompts: { wrapped: string[]; skipped: string[] };
  resources: { wrapped: string[]; skipped: string[] };
} {
  return {
    tools: instrumentAllTools(server, options),
    prompts: instrumentAllPrompts(server, options),
    resources: instrumentAllResources(server, options),
  };
}
