import { describe, expect, it } from "vitest";
import { runEvaluator } from "../runner.js";
import type { Evaluator } from "../types.js";

const alwaysPass: Evaluator = {
  name: "always-pass",
  async evaluate() {
    return { score: 1, passed: true };
  },
};

const alwaysFail: Evaluator = {
  name: "always-fail",
  async evaluate() {
    return { score: 0, passed: false, message: "nope" };
  },
};

const slow: Evaluator = {
  name: "slow",
  async evaluate() {
    await new Promise((r) => setTimeout(r, 20));
    return { score: 1, passed: true };
  },
};

describe("runEvaluator", () => {
  const cases = [
    { id: "a", input: {} },
    { id: "b", input: {} },
    { id: "c", input: {} },
  ];

  it("aggregates pass results", async () => {
    const s = await runEvaluator(alwaysPass, cases);
    expect(s.passed).toBe(3);
    expect(s.meanScore).toBe(1);
  });

  it("aggregates failures", async () => {
    const s = await runEvaluator(alwaysFail, cases);
    expect(s.failed).toBe(3);
    expect(s.meanScore).toBe(0);
  });

  it("handles evaluator exceptions as errored", async () => {
    const throwing: Evaluator = {
      name: "thrower",
      async evaluate() {
        throw new Error("boom");
      },
    };
    const s = await runEvaluator(throwing, cases);
    expect(s.errored).toBe(3);
    expect(s.runs.every((r) => r.error === "boom")).toBe(true);
  });

  it("enforces timeout", async () => {
    const s = await runEvaluator(slow, [{ id: "t", input: {} }], { timeoutMs: 1 });
    expect(s.errored).toBe(1);
    expect(s.runs[0]!.error).toContain("timeout");
  });

  it("runs with concurrency > 1", async () => {
    const start = Date.now();
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, input: {} }));
    const s = await runEvaluator(slow, many, { concurrency: 8 });
    expect(s.passed).toBe(8);
    // 直列なら 160ms 以上、並列なら 80ms 未満で済むはず
    expect(Date.now() - start).toBeLessThan(150);
  });
});
