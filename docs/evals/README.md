# Eval スイート / Evaluation suite / Suite evaluasi

SuguVisa MCP の回帰評価フレームワーク。Golden Records の検索品質、MCP
ツールのルーティング、LLM 応答の引用精度、構造化出力の整合性を
自動で計測する。

This document describes the evaluation framework for SuguVisa MCP that
measures retrieval quality, tool routing correctness, citation accuracy,
and structured-output conformance of the server.

Dokumen ini menjelaskan kerangka evaluasi SuguVisa MCP untuk mengukur
kualitas retrieval, ketepatan routing tool, akurasi sitasi, dan
kesesuaian keluaran terstruktur server.

## 目次 / Contents / Daftar Isi

1. パッケージ構成 / Packages
2. 評価器 / Evaluators
3. データセット / Datasets
4. 実行方法 / Running evals
5. CI との統合 / CI integration
6. 拡張ポイント / Extension points

## 1. パッケージ構成

- `packages/evals/` — TypeScript ライブラリ + CLI
- `evals/datasets/` — JSONL 形式の評価データセット (教師データ)
- `docs/evals/` — 設計書 (本ドキュメント)

```
packages/evals/src/
  types.ts            Eval の共通型 (EvalCase, EvalResult, Evaluator, EvalRunSummary)
  runner.ts           並列/タイムアウト付き Runner
  dataset.ts          JSONL ローダ
  reporter.ts         テキスト/JSON レポーター
  evaluators/
    retrieval.ts      hit@k / MRR / nDCG
    tool-routing.ts   MCP ツールの出力構造チェック
    citation.ts       必須出典 / 禁止出典チェック
    schema.ts         zod スキーマ準拠
    llm-judge.ts      LLM-as-judge + DeterministicJudge (CI 用 fake)
  cli.ts              suguvisa-evals コマンド
```

## 2. 評価器

### 2.1 RetrievalEvaluator
Golden Records Retriever を注入し、クエリごとに `hit@k`, `MRR`, `nDCG`
を算出する。デフォルトのスコアは `hit@k` (0 or 1)。

```typescript
import { RetrievalEvaluator } from "@suguvisa/evals";
import { HybridRetriever, InMemoryGoldenRecordStore, DeterministicEmbeddingProvider } from "@suguvisa/golden-records";

const retriever = new HybridRetriever({ store, embeddings });
const evaluator = new RetrievalEvaluator({ retriever, k: 5, scoreMetric: "hit" });
```

### 2.2 ToolRoutingEvaluator
MCP ツールを呼び出し、期待されるキーやパスが出力に含まれるかを
検証する。呼び出し先は `invokeTool` コールバックで差し替える。

```typescript
const evaluator = new ToolRoutingEvaluator({
  invokeTool: async (name, args) => {
    return await server.callTool({ name, arguments: args });
  },
});
```

### 2.3 CitationEvaluator
LLM 応答に期待される出典 (URL、法令名、参考様式番号など) が
含まれ、禁止された出典 (誤情報) が含まれないかを検証する。

### 2.4 SchemaConformanceEvaluator
zod スキーマを事前登録し、ツール/プロンプト出力が準拠しているかを
検証する。`structuredContent` の回帰保護に使う。

### 2.5 LlmJudgeEvaluator
ルーブリックに従って LLM に採点させる。CI 環境では
`deterministicJudge` (キーワード一致型) を使い決定的に、
ローカル/ステージングでは Anthropic / Vertex AI を差し替える。

## 3. データセット

全ての評価ケースは `evals/datasets/*.jsonl` に JSONL で格納する。

```jsonc
{
  "id": "retr-001",
  "description": "特定技能1号の試験免除に関する質問",
  "input": { "query": "特定技能1号 技能試験 免除" },
  "expected": { "relevantIds": ["rec-ssw1-exemption"] },
  "tags": ["exemption", "ssw1"]
}
```

ファイル先頭の `#` 行はコメント (スキップ)。

現在提供している初期データセット:

| ファイル | 評価器 | 件数 |
|---|---|---|
| `citations.jsonl` | CitationEvaluator | 5 |
| `retrieval-basic.jsonl` | RetrievalEvaluator | 5 |
| `tool-routing.jsonl` | ToolRoutingEvaluator | 3 |
| `judge-answers.jsonl` | LlmJudgeEvaluator | 2 |

## 4. 実行方法

### 4.1 Vitest から
`packages/evals` 配下の `__tests__/*.test.ts` は Vitest で起動でき、
CI の既存パイプラインにそのまま組み込める。

```bash
pnpm --filter @suguvisa/evals test
```

### 4.2 CLI から
Citation 評価はコマンド 1 本で実行できる (他の評価器は Node スクリプトから):

```bash
pnpm eval:citation
# or
node packages/evals/dist/cli.js citation \
  --dataset evals/datasets/citations.jsonl \
  --threshold 1.0 --json
```

失敗ケースが 1 件でもあれば exit code が 1 になる。

### 4.3 Node スクリプトから
Retriever やツールなど外部依存があるものはユーザースクリプトから
起動する。例:

```typescript
import { RetrievalEvaluator, runEvaluator, loadDatasetSync, formatSummaryText } from "@suguvisa/evals";

const cases = loadDatasetSync("evals/datasets/retrieval-basic.jsonl");
const ev = new RetrievalEvaluator({ retriever, k: 5 });
const summary = await runEvaluator(ev, cases);
console.log(formatSummaryText(summary));
```

## 5. CI との統合

`packages/evals` の Vitest はすでに `turbo run test` 経由で走り、
`push` / PR で自動実行される。追加の Retrieval/Tool-routing 評価は、
今後 `.github/workflows/evals.yml` に分離してフラットな pass rate を
PR コメントとして投稿する計画。

ベースライン (初期):
- Retrieval `hit@3` ≥ 80%
- Citation pass rate (正例のみ) ≥ 100%
- Tool routing pass rate ≥ 100%

## 6. 拡張ポイント

- **データセット増強**: Golden Records を増やしつつ retrieval の難度を上げる。
- **Prompt 評価**: `apps/mcp-server/src/resources/prompts.ts` に追加した
  プロンプトについて、citation + schema の組み合わせでベンチ化。
- **多言語**: インドネシア語の質問で日本語 Golden Records が hit するか
  (cross-lingual retrieval) を計測。
- **Drift detection**: mean_score を時系列に記録し、退行検出を自動化。
- **Real LLM judge**: `LlmJudgeEvaluator` の `judge` を Anthropic / Gemini
  に差し替え、ローカル / nightly 実行で活用。
