#!/usr/bin/env node
/**
 * suguvisa-evals — CLI runner
 *
 * 使い方 / Usage:
 *   suguvisa-evals retrieval --dataset evals/datasets/retrieval-basic.jsonl
 *   suguvisa-evals citation  --dataset evals/datasets/citations.jsonl
 *
 * Tool routing や LLM-judge は Node のスクリプト側で evaluator を組み立てる必要があるため、
 * CLI で直接実行できるのは外部依存の少ない citation / schema / retrieval (in-memory) のみ。
 */
import { loadDatasetSync } from "./dataset.js";
import { runEvaluator } from "./runner.js";
import { formatSummaryJson, formatSummaryText } from "./reporter.js";
import { CitationEvaluator } from "./evaluators/citation.js";

type Flags = { dataset?: string; json?: boolean; threshold?: number };

function parseFlags(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dataset") {
      flags.dataset = argv[++i];
    } else if (a === "--json") {
      flags.json = true;
    } else if (a === "--threshold") {
      flags.threshold = Number(argv[++i]);
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseFlags(process.argv.slice(2));
  const kind = positional[0] ?? "";
  if (!kind) {
    console.error(
      "usage: suguvisa-evals <citation> --dataset <path.jsonl> [--json] [--threshold N]",
    );
    process.exit(2);
  }
  if (!flags.dataset) {
    console.error("error: --dataset is required");
    process.exit(2);
  }
  const cases = loadDatasetSync(flags.dataset);

  let summary;
  switch (kind) {
    case "citation": {
      const ev = new CitationEvaluator({ threshold: flags.threshold });
      summary = await runEvaluator(
        ev,
        cases as Parameters<typeof ev.evaluate>[0][],
      );
      break;
    }
    default:
      console.error(
        `unknown evaluator: ${kind}. Supported: citation. For retrieval / tool-routing / schema / llm-judge, use the Node API (see docs/evals/README.md).`,
      );
      process.exit(2);
  }
  if (flags.json) {
    process.stdout.write(formatSummaryJson(summary) + "\n");
  } else {
    process.stdout.write(formatSummaryText(summary) + "\n");
  }
  if (summary.failed + summary.errored > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
