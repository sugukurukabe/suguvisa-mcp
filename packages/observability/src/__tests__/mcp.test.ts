import { describe, expect, it, beforeEach } from "vitest";
import { instrumentTool, recordLlmCall } from "../mcp.js";
import { withObsContext } from "../context.js";
import { InMemoryMetrics, setMetrics } from "../metrics.js";
import { InMemoryLlmTracer, setLlmTracer } from "../langfuse.js";
import { NoopTracer, setTracer } from "../tracer.js";

describe("instrumentTool", () => {
  let metrics: InMemoryMetrics;
  let llmTracer: InMemoryLlmTracer;

  beforeEach(() => {
    metrics = new InMemoryMetrics();
    llmTracer = new InMemoryLlmTracer();
    setMetrics(metrics);
    setLlmTracer(llmTracer);
    setTracer(new NoopTracer());
  });

  it("records counter/histogram and traces on success", async () => {
    const handler = instrumentTool("my_tool", async (args: { q: string }) => ({
      echo: args.q,
    }));
    const res = await withObsContext(
      { requestId: "req-1", tenantId: "tenant-X" },
      () => handler({ q: "hello" }),
    );
    expect(res).toEqual({ echo: "hello" });
    expect(metrics.counters).toContainEqual(
      expect.objectContaining({
        name: "mcp.tool.calls",
        attrs: expect.objectContaining({ tool: "my_tool", status: "success" }),
      }),
    );
    expect(metrics.histograms[0]?.name).toBe("mcp.tool.duration_ms");
    expect(llmTracer.toolEvents).toHaveLength(1);
    expect(llmTracer.toolEvents[0]!.event.tool).toBe("my_tool");
    expect(llmTracer.toolEvents[0]!.ctx.tenantId).toBe("tenant-X");
  });

  it("records error on throw and re-throws", async () => {
    const handler = instrumentTool("fail_tool", async () => {
      throw new Error("boom");
    });
    await expect(
      withObsContext({ requestId: "req-2" }, () => handler({})),
    ).rejects.toThrow("boom");
    expect(metrics.counters[0]?.attrs?.status).toBe("error");
    expect(llmTracer.toolEvents[0]!.event.status).toBe("error");
    expect(llmTracer.toolEvents[0]!.event.errorMessage).toBe("boom");
  });

  it("sanitizes large string args", async () => {
    const handler = instrumentTool("big_tool", async () => "ok");
    const big = "x".repeat(2000);
    await withObsContext({ requestId: "req-3" }, () => handler({ blob: big, a: 1 }));
    const captured = llmTracer.toolEvents[0]!.event.input as Record<string, unknown>;
    expect(captured.blob).toMatch(/^<string len=2000>$/);
    expect(captured.a).toBe(1);
  });

  it("recordLlmCall emits metrics and LLM trace", async () => {
    await withObsContext({ requestId: "req-llm", operation: "llm.generate" }, async () => {
      await recordLlmCall({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        inputTokens: 120,
        outputTokens: 40,
        totalTokens: 160,
        latencyMs: 850,
        status: "success",
      });
    });
    expect(metrics.counters.find((c) => c.name === "llm.calls")).toBeDefined();
    expect(metrics.histograms.find((h) => h.name === "llm.latency_ms")?.value).toBe(850);
    expect(llmTracer.llmEvents).toHaveLength(1);
    expect(llmTracer.llmEvents[0]!.event.model).toBe("claude-sonnet-4-5");
  });
});
