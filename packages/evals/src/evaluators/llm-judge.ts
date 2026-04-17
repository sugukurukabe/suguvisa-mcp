/**
 * LLM-as-Judge 評価器 — 与えられたルーブリックに基づき、LLM（または Fake）に
 * 出力を 0.0 - 1.0 で採点させる。
 *
 * Input:    { response: string; context?: string }
 * Expected: { rubric: string; minScore?: number }
 *
 * 実装は judge() 関数を差し替え可能。CI では DeterministicJudge を使い、
 * ローカル / ステージングで本物の LLM (Anthropic / Vertex) を差し込む。
 */
import type { EvalCase, EvalResult, Evaluator } from "../types.js";

export interface JudgeInput {
  response: string;
  context?: string;
}

export interface JudgeExpected {
  rubric: string;
  /** 合格最低スコア (0.0 - 1.0)。未指定なら evaluator の threshold を使う */
  minScore?: number;
}

export interface JudgeVerdict {
  score: number;
  reasoning: string;
}

export type JudgeFn = (args: {
  input: JudgeInput;
  rubric: string;
}) => Promise<JudgeVerdict>;

export interface LlmJudgeOptions {
  judge: JudgeFn;
  threshold?: number;
  name?: string;
}

export class LlmJudgeEvaluator
  implements Evaluator<JudgeInput, JudgeExpected>
{
  readonly name: string;
  readonly description = "LLM-as-judge scoring against a rubric";
  readonly threshold: number;
  private readonly judge: JudgeFn;

  constructor(options: LlmJudgeOptions) {
    this.judge = options.judge;
    this.threshold = options.threshold ?? 0.7;
    this.name = options.name ?? "llm-judge";
  }

  async evaluate(c: EvalCase<JudgeInput, JudgeExpected>): Promise<EvalResult> {
    if (!c.expected?.rubric) {
      return { score: 0, passed: false, message: "expected.rubric missing" };
    }
    const verdict = await this.judge({ input: c.input, rubric: c.expected.rubric });
    const minScore = c.expected.minScore ?? this.threshold;
    const passed = verdict.score >= minScore;
    return {
      score: verdict.score,
      passed,
      message: passed ? undefined : `judge score ${verdict.score.toFixed(2)} < ${minScore.toFixed(2)}: ${verdict.reasoning}`,
      metrics: { judge_score: verdict.score, min_score: minScore },
      details: { reasoning: verdict.reasoning },
    };
  }
}

/**
 * Deterministic Judge — キーワード一致率でスコアを決める。
 * CI / 単体テストでの再現性を担保する。
 *
 * rubric は `required:foo,bar;forbidden:baz` のような DSL を受け付け、
 * 各 required キーワードの出現で加点、forbidden の出現で 0 に落とす。
 */
export const deterministicJudge: JudgeFn = async ({ input, rubric }) => {
  const required = extractList(rubric, "required");
  const forbidden = extractList(rubric, "forbidden");
  const text = input.response.toLowerCase();
  if (forbidden.some((kw) => text.includes(kw.toLowerCase()))) {
    return { score: 0, reasoning: "forbidden keyword present" };
  }
  if (required.length === 0) return { score: 1, reasoning: "no required keywords, default pass" };
  const hits = required.filter((kw) => text.includes(kw.toLowerCase())).length;
  const score = hits / required.length;
  return {
    score,
    reasoning: `matched ${hits}/${required.length} required keywords`,
  };
};

function extractList(rubric: string, key: string): string[] {
  const m = new RegExp(`${key}:([^;]+)`, "i").exec(rubric);
  if (!m) return [];
  return m[1]!
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
