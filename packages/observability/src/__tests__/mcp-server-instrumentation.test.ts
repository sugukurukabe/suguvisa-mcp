import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  instrumentAllPrompts,
  instrumentAllResources,
  instrumentAllTools,
  instrumentMcpServer,
} from "../mcp-server-instrumentation.js";
import { withObsContext } from "../context.js";
import { InMemoryMetrics, setMetrics } from "../metrics.js";
import { InMemoryLlmTracer, setLlmTracer } from "../langfuse.js";
import { NoopTracer, setTracer } from "../tracer.js";

describe("instrument MCP server (bulk)", () => {
  let metrics: InMemoryMetrics;
  let llmTracer: InMemoryLlmTracer;
  let server: McpServer;

  beforeEach(() => {
    metrics = new InMemoryMetrics();
    llmTracer = new InMemoryLlmTracer();
    setMetrics(metrics);
    setLlmTracer(llmTracer);
    setTracer(new NoopTracer());
    server = new McpServer({ name: "test", version: "0.0.0" });
  });

  it("wraps every registered tool and still returns correct result", async () => {
    server.registerTool(
      "echo",
      {
        description: "echo args.q",
        inputSchema: { q: z.string() },
      },
      async (args) => ({
        content: [{ type: "text" as const, text: args.q }],
      }),
    );
    server.registerTool(
      "zero_arg",
      { description: "zero-arg tool" },
      async () => ({ content: [{ type: "text" as const, text: "hi" }] }),
    );

    const report = instrumentAllTools(server);
    expect(report.wrapped).toEqual(expect.arrayContaining(["echo", "zero_arg"]));
    expect(report.skipped).toEqual([]);

    const internals = server as unknown as {
      _registeredTools: Record<string, { handler: (...a: unknown[]) => unknown }>;
    };
    const res = await withObsContext(
      { requestId: "r1", tenantId: "t1" },
      () =>
        internals._registeredTools.echo!.handler({ q: "ok" }, {
          signal: new AbortController().signal,
        }),
    );
    expect((res as { content: Array<{ text: string }> }).content[0]!.text).toBe("ok");
    expect(metrics.counters.some((c) => c.name === "mcp.tool.calls")).toBe(true);
    expect(llmTracer.toolEvents[0]!.event.tool).toBe("echo");

    const zero = await withObsContext(
      { requestId: "r2" },
      () =>
        internals._registeredTools.zero_arg!.handler({
          signal: new AbortController().signal,
        }),
    );
    expect((zero as { content: Array<{ text: string }> }).content[0]!.text).toBe("hi");
  });

  it("does not double-wrap on repeated instrumentation", async () => {
    server.registerTool(
      "once",
      { description: "x", inputSchema: { a: z.number() } },
      async () => ({ content: [{ type: "text" as const, text: "1" }] }),
    );
    const first = instrumentAllTools(server);
    const second = instrumentAllTools(server);
    expect(first.wrapped).toContain("once");
    expect(second.skipped).toContain("once");
  });

  it("wraps prompts", async () => {
    server.prompt(
      "greet",
      { name: z.string() },
      async ({ name }) => ({
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: `hi ${name}` },
          },
        ],
      }),
    );
    const report = instrumentAllPrompts(server);
    expect(report.wrapped).toContain("greet");
    const internals = server as unknown as {
      _registeredPrompts: Record<string, { callback: (...a: unknown[]) => unknown }>;
    };
    await withObsContext({ requestId: "p1" }, () =>
      internals._registeredPrompts.greet!.callback(
        { name: "Kabe" },
        { signal: new AbortController().signal },
      ),
    );
    expect(metrics.counters.some((c) => c.name === "mcp.prompt.calls")).toBe(true);
  });

  it("wraps static resources and resource templates", async () => {
    server.registerResource(
      "info",
      "suguvisa://info",
      { description: "info", mimeType: "application/json" },
      async () => ({
        contents: [
          { uri: "suguvisa://info", mimeType: "application/json", text: "{}" },
        ],
      }),
    );
    const report = instrumentAllResources(server);
    expect(report.wrapped).toContain("suguvisa://info");
    const internals = server as unknown as {
      _registeredResources: Record<string, { readCallback: (...a: unknown[]) => unknown }>;
    };
    await withObsContext({ requestId: "res1" }, () =>
      internals._registeredResources["suguvisa://info"]!.readCallback(
        new URL("suguvisa://info"),
        {
          signal: new AbortController().signal,
        },
      ),
    );
    expect(metrics.counters.some((c) => c.name === "mcp.resource.reads")).toBe(true);
  });

  it("instrumentMcpServer hits all three layers at once", () => {
    server.registerTool(
      "t",
      { description: "x", inputSchema: { a: z.number() } },
      async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    );
    server.prompt("p", async () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: "x" } }],
    }));
    server.registerResource(
      "r",
      "suguvisa://r",
      { description: "r" },
      async () => ({
        contents: [{ uri: "suguvisa://r", mimeType: "application/json", text: "{}" }],
      }),
    );
    const report = instrumentMcpServer(server);
    expect(report.tools.wrapped).toContain("t");
    expect(report.prompts.wrapped).toContain("p");
    expect(report.resources.wrapped).toContain("suguvisa://r");
  });
});
