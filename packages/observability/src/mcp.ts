import { getObsContext, updateObsContext } from "./context.js";
import { getLlmTracer } from "./langfuse.js";
import { getMetrics } from "./metrics.js";
import { getTracer } from "./tracer.js";
import type { LlmCallEvent, ObsContext, ToolCallEvent } from "./types.js";

/**
 * MCP ツールハンドラのシグネチャ
 * Signature for an MCP tool handler
 * Tanda tangan untuk handler tool MCP
 */
export type McpToolHandler<TArgs = Record<string, unknown>, TResult = unknown> = (
  args: TArgs,
) => Promise<TResult>;

/**
 * ツール呼び出しを観測するラッパ
 * Wrap an MCP tool handler with observability
 * Bungkus handler tool MCP dengan observability
 *
 * - Tracer で span を張る
 * - Metrics で count / duration を記録
 * - Langfuse (LlmTracer) に tool call を送信
 * - 例外時は span status を error に、metric のラベルを status=error に
 */
export function instrumentTool<TArgs, TResult>(
  toolName: string,
  handler: McpToolHandler<TArgs, TResult>,
): McpToolHandler<TArgs, TResult> {
  return async (args: TArgs): Promise<TResult> => {
    const tracer = getTracer();
    const metrics = getMetrics();
    const llmTracer = getLlmTracer();
    const ctx = getObsContext() ?? ({ requestId: "unknown", operation: toolName } as ObsContext);
    updateObsContext({ operation: toolName });

    const start = Date.now();
    try {
      const result = await tracer.startSpan(
        `mcp.tool.${toolName}`,
        async (span) => {
          span.setAttribute("mcp.tool", toolName);
          span.setAttribute("mcp.request_id", ctx.requestId);
          if (ctx.tenantId) span.setAttribute("mcp.tenant_id", ctx.tenantId);
          if (ctx.principalSubject) span.setAttribute("mcp.principal", ctx.principalSubject);
          const res = await handler(args);
          span.setStatus("ok");
          return res;
        },
      );
      const duration = Date.now() - start;
      metrics.counter("mcp.tool.calls", 1, { tool: toolName, status: "success" });
      metrics.histogram("mcp.tool.duration_ms", duration, { tool: toolName, status: "success" });
      await llmTracer.traceToolCall(ctx, buildToolEvent(toolName, args, duration, "success"));
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      metrics.counter("mcp.tool.calls", 1, { tool: toolName, status: "error" });
      metrics.histogram("mcp.tool.duration_ms", duration, { tool: toolName, status: "error" });
      await llmTracer.traceToolCall(
        ctx,
        buildToolEvent(toolName, args, duration, "error", err),
      );
      throw err;
    }
  };
}

function buildToolEvent<TArgs>(
  tool: string,
  args: TArgs,
  durationMs: number,
  status: "success" | "error",
  err?: unknown,
): ToolCallEvent {
  return {
    tool,
    durationMs,
    status,
    input: sanitizeArgs(args),
    errorMessage: err instanceof Error ? err.message : err ? String(err) : undefined,
  };
}

function sanitizeArgs<TArgs>(args: TArgs): Record<string, unknown> | undefined {
  if (!args || typeof args !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (typeof v === "string" && v.length > 512) {
      out[k] = `<string len=${v.length}>`;
    } else if (typeof v === "object") {
      out[k] = Array.isArray(v) ? `<array len=${v.length}>` : "<object>";
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * LLM 呼び出しを記録するヘルパ
 * Helper to record a single LLM call
 * Helper untuk mencatat satu pemanggilan LLM
 */
export async function recordLlmCall(event: LlmCallEvent): Promise<void> {
  const ctx = getObsContext();
  if (!ctx) return;
  const metrics = getMetrics();
  metrics.counter("llm.calls", 1, {
    provider: event.provider,
    model: event.model,
    status: event.status,
  });
  metrics.histogram("llm.latency_ms", event.latencyMs, {
    provider: event.provider,
    model: event.model,
  });
  if (event.totalTokens !== undefined) {
    metrics.histogram("llm.total_tokens", event.totalTokens, {
      provider: event.provider,
      model: event.model,
    });
  }
  await getLlmTracer().traceLlmCall(ctx, event);
}
