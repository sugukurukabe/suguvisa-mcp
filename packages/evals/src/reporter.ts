/**
 * Reporter — EvalRunSummary を人間可読な形式 / JSON で出力
 * Reporter for eval run summaries
 * Pelaporan hasil evaluasi
 */
import type { EvalRunSummary } from "./types.js";

export function formatSummaryText(summary: EvalRunSummary): string {
  const lines: string[] = [];
  const passRate = summary.total === 0 ? 0 : summary.passed / summary.total;
  const passPct = (passRate * 100).toFixed(1);
  lines.push(`=== ${summary.evaluator} ===`);
  lines.push(
    `total=${summary.total}  passed=${summary.passed}  failed=${summary.failed}  errored=${summary.errored}  pass_rate=${passPct}%  mean_score=${summary.meanScore.toFixed(3)}`,
  );
  lines.push(
    `latency: p50=${summary.latency.p50Ms}ms p95=${summary.latency.p95Ms}ms`,
  );
  const failures = summary.runs.filter((r) => !r.result.passed);
  if (failures.length > 0) {
    lines.push(`--- failures (${failures.length}) ---`);
    for (const f of failures.slice(0, 20)) {
      lines.push(
        `  - [${f.case.id}] score=${f.result.score.toFixed(2)} ${f.result.message ?? ""}`,
      );
    }
    if (failures.length > 20) {
      lines.push(`  ... and ${failures.length - 20} more`);
    }
  }
  return lines.join("\n");
}

/**
 * GitHub Actions が読みやすい JSON 形式で要約を返す
 */
export function formatSummaryJson(summary: EvalRunSummary): string {
  return JSON.stringify(
    {
      evaluator: summary.evaluator,
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      errored: summary.errored,
      meanScore: summary.meanScore,
      passRate: summary.total === 0 ? 0 : summary.passed / summary.total,
      latency: summary.latency,
      failures: summary.runs
        .filter((r) => !r.result.passed)
        .map((r) => ({
          id: r.case.id,
          score: r.result.score,
          message: r.result.message,
        })),
    },
    null,
    2,
  );
}
