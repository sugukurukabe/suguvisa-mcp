/**
 * Eval Runner — 1 つの evaluator を 1 つのデータセットに対して走らせ、集計する
 * Eval runner
 * Penjalankan evaluasi
 */
import type {
  EvalCase,
  EvalCaseRun,
  EvalResult,
  EvalRunSummary,
  Evaluator,
} from "./types.js";

export interface RunOptions {
  /** 1 ケースあたりのタイムアウト (ms) */
  timeoutMs?: number;
  /** 並列実行数 */
  concurrency?: number;
  /** 進捗コールバック */
  onProgress?: (ran: number, total: number, last: EvalCaseRun) => void;
}

/**
 * 評価器を 1 つのデータセットに対して実行
 */
export async function runEvaluator<TInput, TExpected>(
  evaluator: Evaluator<TInput, TExpected>,
  dataset: Array<EvalCase<TInput, TExpected>>,
  options: RunOptions = {},
): Promise<EvalRunSummary> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const runs: EvalCaseRun<TInput, TExpected>[] = [];
  let cursor = 0;

  async function next(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= dataset.length) return;
      const c = dataset[idx]!;
      const run = await runOne(evaluator, c, timeoutMs);
      runs.push(run);
      options.onProgress?.(runs.length, dataset.length, run);
    }
  }

  const workers = Array.from({ length: concurrency }, () => next());
  await Promise.all(workers);

  return summarize(evaluator.name, runs);
}

async function runOne<TInput, TExpected>(
  evaluator: Evaluator<TInput, TExpected>,
  c: EvalCase<TInput, TExpected>,
  timeoutMs: number,
): Promise<EvalCaseRun<TInput, TExpected>> {
  const start = Date.now();
  try {
    const result = await withTimeout(evaluator.evaluate(c), timeoutMs);
    return {
      case: c,
      evaluator: evaluator.name,
      result,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed: EvalResult = {
      score: 0,
      passed: false,
      message: `evaluator threw: ${message}`,
    };
    return {
      case: c,
      evaluator: evaluator.name,
      result: failed,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

function summarize<TInput, TExpected>(
  evaluatorName: string,
  runs: EvalCaseRun<TInput, TExpected>[],
): EvalRunSummary {
  const total = runs.length;
  const passed = runs.filter((r) => r.result.passed).length;
  const errored = runs.filter((r) => r.error !== undefined).length;
  const failed = total - passed - errored;
  const meanScore =
    total === 0 ? 0 : runs.reduce((sum, r) => sum + r.result.score, 0) / total;
  const latencies = runs.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  return {
    evaluator: evaluatorName,
    total,
    passed,
    failed,
    errored,
    meanScore,
    latency: { p50Ms: p50, p95Ms: p95 },
    runs: runs as EvalCaseRun[],
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx]!;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`evaluator timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
