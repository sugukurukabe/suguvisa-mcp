import { describe, expect, it } from "vitest";
import { ToolRoutingEvaluator } from "../evaluators/tool-routing.js";
import { runEvaluator } from "../runner.js";

describe("ToolRoutingEvaluator", () => {
  it("passes when output has expected path", async () => {
    const ev = new ToolRoutingEvaluator({
      invokeTool: async () => ({
        structuredContent: { pattern_id: "GRANT_01" },
      }),
    });
    const res = await ev.evaluate({
      id: "t",
      input: { toolName: "suguvisa_application_type_determine", args: {} },
      expected: { outputHasPath: ["structuredContent.pattern_id"] },
    });
    expect(res.passed).toBe(true);
  });

  it("fails when expected containment is missing", async () => {
    const ev = new ToolRoutingEvaluator({
      invokeTool: async () => ({ structuredContent: {} }),
    });
    const res = await ev.evaluate({
      id: "t",
      input: { toolName: "suguvisa_application_type_determine", args: {} },
      expected: { outputContains: { structuredContent: { pattern_id: "GRANT_01" } } },
    });
    expect(res.passed).toBe(false);
    expect(res.message).toContain("contains");
  });

  it("reports error when invocation throws", async () => {
    const ev = new ToolRoutingEvaluator({
      invokeTool: async () => {
        throw new Error("boom");
      },
    });
    const res = await ev.evaluate({
      id: "t",
      input: { toolName: "x", args: {} },
      expected: { outputHasPath: ["a"] },
    });
    expect(res.passed).toBe(false);
    expect(res.message).toContain("boom");
  });

  it("aggregates multiple cases", async () => {
    const ev = new ToolRoutingEvaluator({
      invokeTool: async (_t, args) => ({ structuredContent: { echo: args } }),
    });
    const summary = await runEvaluator(ev, [
      {
        id: "a",
        input: { toolName: "x", args: { a: 1 } },
        expected: { outputHasPath: ["structuredContent.echo.a"] },
      },
      {
        id: "b",
        input: { toolName: "x", args: { a: 2 } },
        expected: { outputHasPath: ["structuredContent.echo.a"] },
      },
    ]);
    expect(summary.passed).toBe(2);
  });
});
