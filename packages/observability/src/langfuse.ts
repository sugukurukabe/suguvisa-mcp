import type { LlmCallEvent, LlmTracer, ObsContext, ToolCallEvent } from "./types.js";

/**
 * LLM 呼び出しを in-memory で保持する Tracer
 * In-memory LLM tracer for testing
 * Tracer LLM dalam memori untuk pengujian
 */
export class InMemoryLlmTracer implements LlmTracer {
  llmEvents: Array<{ ctx: ObsContext; event: LlmCallEvent }> = [];
  toolEvents: Array<{ ctx: ObsContext; event: ToolCallEvent }> = [];

  async traceLlmCall(ctx: ObsContext, event: LlmCallEvent): Promise<void> {
    this.llmEvents.push({ ctx: cloneCtx(ctx), event: { ...event } });
  }

  async traceToolCall(ctx: ObsContext, event: ToolCallEvent): Promise<void> {
    this.toolEvents.push({ ctx: cloneCtx(ctx), event: { ...event } });
  }

  async flush(): Promise<void> {
    // no-op
  }

  clear(): void {
    this.llmEvents = [];
    this.toolEvents = [];
  }
}

function cloneCtx(ctx: ObsContext): ObsContext {
  return { ...ctx, attrs: ctx.attrs ? { ...ctx.attrs } : undefined };
}

/**
 * Langfuse アダプタ設定
 */
export interface LangfuseTracerOptions {
  publicKey: string;
  secretKey: string;
  /** 例: "https://cloud.langfuse.com" */
  baseUrl?: string;
  /** バッチ送信間隔 (ms) */
  flushIntervalMs?: number;
  /** プロジェクトタグ */
  release?: string;
}

/**
 * Langfuse への送信アダプタ
 * Langfuse-backed LLM tracer
 * Tracer LLM berbasis Langfuse
 *
 * langfuse パッケージは optional peer dependency。
 * dynamic import で static 解析を回避する。
 */
export class LangfuseTracer implements LlmTracer {
  readonly #opts: LangfuseTracerOptions;
  #clientPromise?: Promise<LangfuseClient>;

  constructor(opts: LangfuseTracerOptions) {
    this.#opts = opts;
  }

  async traceLlmCall(ctx: ObsContext, event: LlmCallEvent): Promise<void> {
    const client = await this.#getClient();
    const trace = client.trace({
      id: ctx.requestId,
      name: ctx.operation ?? "mcp.tool",
      userId: ctx.principalSubject,
      sessionId: ctx.tenantId,
      metadata: ctx.attrs,
    });
    trace.generation({
      name: `${event.provider}:${event.model}`,
      model: event.model,
      modelParameters: event.metadata as Record<string, unknown> | undefined,
      input: event.prompt,
      output: event.response,
      usage: {
        input: event.inputTokens,
        output: event.outputTokens,
        total: event.totalTokens,
      },
      startTime: new Date(Date.now() - event.latencyMs),
      endTime: new Date(),
      level: event.status === "error" ? "ERROR" : "DEFAULT",
      statusMessage: event.errorMessage,
    });
  }

  async traceToolCall(ctx: ObsContext, event: ToolCallEvent): Promise<void> {
    const client = await this.#getClient();
    const trace = client.trace({
      id: ctx.requestId,
      name: ctx.operation ?? "mcp.tool",
      userId: ctx.principalSubject,
      sessionId: ctx.tenantId,
      metadata: ctx.attrs,
    });
    trace.span({
      name: event.tool,
      input: event.input,
      startTime: new Date(Date.now() - event.durationMs),
      endTime: new Date(),
      level: event.status === "error" ? "ERROR" : "DEFAULT",
      statusMessage: event.errorMessage,
    });
  }

  async flush(): Promise<void> {
    const client = await this.#getClient();
    await client.flushAsync();
  }

  async #getClient(): Promise<LangfuseClient> {
    if (!this.#clientPromise) {
      this.#clientPromise = this.#createClient();
    }
    return this.#clientPromise;
  }

  async #createClient(): Promise<LangfuseClient> {
    const dynImport = new Function("specifier", "return import(specifier);") as (
      s: string,
    ) => Promise<Record<string, unknown>>;
    const mod = (await dynImport("langfuse")) as {
      Langfuse: new (options: {
        publicKey: string;
        secretKey: string;
        baseUrl?: string;
        flushInterval?: number;
        release?: string;
      }) => LangfuseClient;
    };
    return new mod.Langfuse({
      publicKey: this.#opts.publicKey,
      secretKey: this.#opts.secretKey,
      baseUrl: this.#opts.baseUrl,
      flushInterval: this.#opts.flushIntervalMs,
      release: this.#opts.release,
    });
  }
}

interface LangfuseClient {
  trace(args: {
    id?: string;
    name?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): LangfuseTrace;
  flushAsync(): Promise<void>;
}

interface LangfuseTrace {
  generation(args: {
    name: string;
    model: string;
    modelParameters?: Record<string, unknown>;
    input?: string;
    output?: string;
    usage?: { input?: number; output?: number; total?: number };
    startTime?: Date;
    endTime?: Date;
    level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
    statusMessage?: string;
  }): void;
  span(args: {
    name: string;
    input?: Record<string, unknown>;
    startTime?: Date;
    endTime?: Date;
    level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
    statusMessage?: string;
  }): void;
}

let defaultLlmTracer: LlmTracer = new InMemoryLlmTracer();

export function getLlmTracer(): LlmTracer {
  return defaultLlmTracer;
}

export function setLlmTracer(t: LlmTracer): void {
  defaultLlmTracer = t;
}
