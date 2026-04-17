/**
 * Retrieval 評価器 — Golden Records (または任意の Retriever) の検索品質を測る
 * Retrieval evaluator using ranking metrics (hit@k, MRR, nDCG)
 * Evaluator retrieval menggunakan metrik pemeringkatan
 *
 * Input:
 *  { query: string, filter?: RecordFilter }
 * Expected:
 *  { relevantIds: string[] }
 *
 * Score:
 *  default = hit@k (0 or 1), metrics には hit@k / mrr / ndcg を全て載せる
 */
import type { Retriever, SearchHit } from "@suguvisa/golden-records";
import type { EvalCase, EvalResult, Evaluator } from "../types.js";

export interface RetrievalInput {
  query: string;
  topK?: number;
  filter?: Record<string, unknown>;
}

export interface RetrievalExpected {
  /** 正解 Record の id 群 */
  relevantIds: string[];
  /** 順位が厳密な場合の期待順序 (任意) */
  idealOrder?: string[];
}

export interface RetrievalEvaluatorOptions {
  retriever: Retriever;
  /** hit@k の k (default 5) */
  k?: number;
  /** score を "hit" とするか "mrr" とするか "ndcg" とするか (default "hit") */
  scoreMetric?: "hit" | "mrr" | "ndcg";
  /** 合否の閾値 (default 1.0) */
  threshold?: number;
  name?: string;
}

export class RetrievalEvaluator
  implements Evaluator<RetrievalInput, RetrievalExpected>
{
  readonly name: string;
  readonly description = "Golden Records retrieval quality (hit@k / MRR / nDCG)";
  readonly threshold: number;
  private readonly retriever: Retriever;
  private readonly k: number;
  private readonly scoreMetric: "hit" | "mrr" | "ndcg";

  constructor(options: RetrievalEvaluatorOptions) {
    this.retriever = options.retriever;
    this.k = options.k ?? 5;
    this.scoreMetric = options.scoreMetric ?? "hit";
    this.threshold = options.threshold ?? 1.0;
    this.name = options.name ?? "retrieval";
  }

  async evaluate(
    c: EvalCase<RetrievalInput, RetrievalExpected>,
  ): Promise<EvalResult> {
    const expected = c.expected;
    if (!expected || !Array.isArray(expected.relevantIds)) {
      return {
        score: 0,
        passed: false,
        message: "expected.relevantIds is required for retrieval eval",
      };
    }
    const topK = c.input.topK ?? this.k;
    const hits = await this.retriever.search({
      query: c.input.query,
      topK,
      filter: c.input.filter as RetrievalInput["filter"] as never,
    });
    const ranked = hits.map((h: SearchHit) => h.record.id);
    const relevant = new Set(expected.relevantIds);

    const hitAtK = ranked.slice(0, this.k).some((id) => relevant.has(id)) ? 1 : 0;
    const mrr = mrrScore(ranked, relevant);
    const ndcg = ndcgScore(ranked, expected.idealOrder ?? expected.relevantIds, this.k);

    const score =
      this.scoreMetric === "mrr" ? mrr : this.scoreMetric === "ndcg" ? ndcg : hitAtK;
    const passed = score >= this.threshold;
    return {
      score,
      passed,
      message: passed
        ? undefined
        : `no relevant id in top-${this.k}. expected ${expected.relevantIds.join("/")}; got ${ranked.slice(0, this.k).join(", ")}`,
      metrics: {
        [`hit@${this.k}`]: hitAtK,
        mrr,
        ndcg,
      },
      details: {
        query: c.input.query,
        ranked: ranked.slice(0, this.k),
      },
    };
  }
}

export function mrrScore(ranked: string[], relevant: Set<string>): number {
  for (let i = 0; i < ranked.length; i++) {
    if (relevant.has(ranked[i]!)) return 1 / (i + 1);
  }
  return 0;
}

/**
 * Normalized Discounted Cumulative Gain
 * 関連度を binary (1 or 0) とみなす簡易版。
 */
export function ndcgScore(ranked: string[], ideal: string[], k: number): number {
  const relevant = new Set(ideal);
  const dcg = (items: string[]) =>
    items
      .slice(0, k)
      .reduce((sum, id, i) => sum + (relevant.has(id) ? 1 / Math.log2(i + 2) : 0), 0);
  const idealDcg = dcg(ideal);
  if (idealDcg === 0) return 0;
  return dcg(ranked) / idealDcg;
}
