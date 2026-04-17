import { describe, expect, it } from "vitest";
import { CitationEvaluator } from "../evaluators/citation.js";
import { runEvaluator } from "../runner.js";
import { parseJsonl } from "../dataset.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.resolve(__dirname, "../../../../evals/datasets/citations.jsonl");

describe("CitationEvaluator", () => {
  it("passes when all required citations are present", async () => {
    const ev = new CitationEvaluator();
    const res = await ev.evaluate({
      id: "t",
      input: { answer: "入管法 第19条の16 に基づき、14日以内に届出。" },
      expected: { mustCite: ["入管法", "19条の16"] },
    });
    expect(res.passed).toBe(true);
    expect(res.score).toBe(1);
  });

  it("fails and reports missing citations", async () => {
    const ev = new CitationEvaluator();
    const res = await ev.evaluate({
      id: "t",
      input: { answer: "14日以内に届けてください。" },
      expected: { mustCite: ["入管法", "19条の16"] },
    });
    expect(res.passed).toBe(false);
    expect(res.score).toBe(0);
    expect(res.message).toContain("19条の16");
  });

  it("zeroes out when forbidden citation appears", async () => {
    const ev = new CitationEvaluator();
    const res = await ev.evaluate({
      id: "t",
      input: { answer: "ご自由にどうぞ。申請中もどこでも働けます。" },
      expected: {
        mustCite: ["申請中"],
        forbidden: ["どこでも働けます"],
      },
    });
    expect(res.score).toBe(0);
    expect(res.passed).toBe(false);
  });

  it("runs full dataset and aggregates results", async () => {
    const text = fs.readFileSync(DATASET, "utf-8");
    const cases = parseJsonl(text);
    const ev = new CitationEvaluator();
    const summary = await runEvaluator(
      ev,
      cases as Parameters<typeof ev.evaluate>[0][],
    );
    expect(summary.total).toBe(cases.length);
    // 禁止例 (cite-003) を除く 4 件は合格、cite-003 は forbidden により失敗
    expect(summary.passed).toBe(4);
    expect(summary.failed).toBe(1);
  });
});
