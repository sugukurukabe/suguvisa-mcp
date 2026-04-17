/**
 * Evaluation 型定義
 * Evaluation types
 * Tipe evaluasi
 */

/**
 * 1 件の評価ケース
 * A single evaluation case
 * Satu kasus evaluasi
 */
export interface EvalCase<TInput = unknown, TExpected = unknown> {
  id: string;
  description?: string;
  /** 評価対象への入力 */
  input: TInput;
  /** 期待値（教師データ） */
  expected?: TExpected;
  /** タグ（カテゴリ・難度など） */
  tags?: string[];
  /** メタデータ (ソース・バージョン等) */
  metadata?: Record<string, unknown>;
}

/**
 * 評価器の結果
 * Evaluator result
 * Hasil evaluator
 */
export interface EvalResult {
  /** 0.0 - 1.0 のスカラー。二値の場合は 0 or 1 */
  score: number;
  /** そのケースの合否 (score >= threshold) */
  passed: boolean;
  /** 診断メッセージ (失敗時) */
  message?: string;
  /** 追加の数値メトリクス */
  metrics?: Record<string, number>;
  /** 評価器固有の詳細 */
  details?: Record<string, unknown>;
}

/**
 * 評価器インターフェース
 * Evaluator interface
 * Antarmuka evaluator
 */
export interface Evaluator<TInput = unknown, TExpected = unknown> {
  readonly name: string;
  readonly description?: string;
  /**
   * 合格とみなす最小スコア (default 1.0)
   * Minimum score to pass
   */
  readonly threshold?: number;
  evaluate(c: EvalCase<TInput, TExpected>): Promise<EvalResult>;
}

/**
 * 1 件のケースに対する実行結果
 * Execution result for a single case
 * Hasil eksekusi untuk satu kasus
 */
export interface EvalCaseRun<TInput = unknown, TExpected = unknown> {
  case: EvalCase<TInput, TExpected>;
  evaluator: string;
  result: EvalResult;
  /** 秒数 */
  durationMs: number;
  /** 例外が発生した場合のエラーメッセージ */
  error?: string;
}

/**
 * 一回の Eval スイート実行の総合結果
 * Aggregate result of a single eval run
 * Hasil agregat dari satu eksekusi eval
 */
export interface EvalRunSummary {
  evaluator: string;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  /** 平均スコア */
  meanScore: number;
  /** p50, p95 の duration */
  latency: { p50Ms: number; p95Ms: number };
  runs: EvalCaseRun[];
}
