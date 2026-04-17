import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SchemaConformanceEvaluator } from "../evaluators/schema.js";
import {
  LlmJudgeEvaluator,
  deterministicJudge,
} from "../evaluators/llm-judge.js";
import { runEvaluator } from "../runner.js";
import { parseJsonl } from "../dataset.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JUDGE_DS = path.resolve(__dirname, "../../../../evals/datasets/judge-answers.jsonl");

describe("SchemaConformanceEvaluator", () => {
  const schemas = {
    deadline: z.object({
      pattern_id: z.string(),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  };

  it("passes valid output", async () => {
    const ev = new SchemaConformanceEvaluator({ schemas });
    const res = await ev.evaluate({
      id: "t",
      input: { output: { pattern_id: "GRANT_01", deadline: "2026-05-31" } },
      expected: { schemaKey: "deadline" },
    });
    expect(res.passed).toBe(true);
  });

  it("reports zod issues for bad output", async () => {
    const ev = new SchemaConformanceEvaluator({ schemas });
    const res = await ev.evaluate({
      id: "t",
      input: { output: { pattern_id: 123, deadline: "2026/05/31" } },
      expected: { schemaKey: "deadline" },
    });
    expect(res.passed).toBe(false);
    expect(res.message).toContain("pattern_id");
  });
});

describe("LlmJudgeEvaluator with deterministicJudge", () => {
  it("scores by keyword match", async () => {
    const ev = new LlmJudgeEvaluator({ judge: deterministicJudge, threshold: 0.8 });
    const res = await ev.evaluate({
      id: "t",
      input: { response: "特定技能1号の通算在留期間は上限5年です" },
      expected: { rubric: "required:5年,上限,特定技能1号" },
    });
    expect(res.score).toBe(1);
  });

  it("returns 0 on forbidden keyword", async () => {
    const ev = new LlmJudgeEvaluator({ judge: deterministicJudge });
    const res = await ev.evaluate({
      id: "t",
      input: { response: "何でも働けます" },
      expected: { rubric: "required:働けます;forbidden:何でも" },
    });
    expect(res.score).toBe(0);
  });

  it("runs the judge dataset", async () => {
    const cases = parseJsonl(fs.readFileSync(JUDGE_DS, "utf-8"));
    const ev = new LlmJudgeEvaluator({ judge: deterministicJudge, threshold: 0.8 });
    const summary = await runEvaluator(
      ev,
      cases as Parameters<typeof ev.evaluate>[0][],
    );
    expect(summary.total).toBe(cases.length);
    expect(summary.passed).toBe(cases.length);
  });
});
