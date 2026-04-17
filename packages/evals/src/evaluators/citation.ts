/**
 * Citation 評価器 — LLM の回答文が期待される出典 (URL / Source name) を
 * 含んでいるかをチェックする。
 *
 * Input:    { answer: string }
 * Expected: { mustCite: string[]; forbidden?: string[] }
 *
 * `mustCite` に含まれる文字列がすべて出力に含まれれば hit。
 * `forbidden` はハルシネーションで出てはいけない URL / 名前を指定できる。
 */
import type { EvalCase, EvalResult, Evaluator } from "../types.js";

export interface CitationInput {
  answer: string;
}

export interface CitationExpected {
  mustCite: string[];
  forbidden?: string[];
  /** 大文字小文字を区別するか (default false) */
  caseSensitive?: boolean;
}

export interface CitationEvaluatorOptions {
  threshold?: number;
  name?: string;
}

export class CitationEvaluator
  implements Evaluator<CitationInput, CitationExpected>
{
  readonly name: string;
  readonly description = "Answer contains required citations and no forbidden sources";
  readonly threshold: number;

  constructor(options: CitationEvaluatorOptions = {}) {
    this.threshold = options.threshold ?? 1.0;
    this.name = options.name ?? "citation";
  }

  async evaluate(
    c: EvalCase<CitationInput, CitationExpected>,
  ): Promise<EvalResult> {
    if (!c.expected) {
      return {
        score: 0,
        passed: false,
        message: "expected citations not provided",
      };
    }
    const cs = c.expected.caseSensitive ?? false;
    const ans = cs ? c.input.answer : c.input.answer.toLowerCase();
    const must = c.expected.mustCite.map((s) => (cs ? s : s.toLowerCase()));
    const forbidden = (c.expected.forbidden ?? []).map((s) =>
      cs ? s : s.toLowerCase(),
    );

    const foundCount = must.filter((s) => ans.includes(s)).length;
    const missingCitations = must.filter((s) => !ans.includes(s));
    const forbiddenHits = forbidden.filter((s) => ans.includes(s));

    const hasForbidden = forbiddenHits.length > 0;
    const citationScore = must.length === 0 ? 1 : foundCount / must.length;
    const score = hasForbidden ? 0 : citationScore;
    const passed = !hasForbidden && score >= this.threshold;

    const parts: string[] = [];
    if (missingCitations.length > 0) {
      parts.push(`missing citations: ${missingCitations.join(", ")}`);
    }
    if (forbiddenHits.length > 0) {
      parts.push(`forbidden citations present: ${forbiddenHits.join(", ")}`);
    }

    return {
      score,
      passed,
      message: passed ? undefined : parts.join("; "),
      metrics: {
        citations_expected: must.length,
        citations_found: foundCount,
        forbidden_hits: forbiddenHits.length,
      },
      details: { missingCitations, forbiddenHits },
    };
  }
}
