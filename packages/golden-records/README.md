# @suguvisa/golden-records

## 概要 / Overview / Ikhtisar

Golden Records のデータアクセス層とハイブリッド検索ライブラリ。
LLM エージェントが引用可能な信頼できる知識を検索するための基盤。

Data access and hybrid search library for Golden Records.
Foundation for LLM agents to retrieve citation-grounded, trustworthy knowledge.

Lapisan akses data dan pencarian hibrida untuk Golden Records.
Fondasi bagi agen LLM untuk mengambil pengetahuan tepercaya yang dapat dikutip.

## 公開 API / Public API / API Publik

### 型 / Types / Tipe

```typescript
import {
  GoldenRecord,
  GoldenRecordType,
  Citation,
  SearchQuery,
  SearchHit,
  Retriever,
  GoldenRecordStore,
  EmbeddingProvider,
  VectorSearchProvider,
  GLOBAL_TENANT_ID,
} from "@suguvisa/golden-records";
```

### ストア / Stores

- `InMemoryGoldenRecordStore` — テスト / 開発用
- `FirestoreGoldenRecordStore` — 本番用（@google-cloud/firestore を optional peer dep として使用）

```typescript
import { InMemoryGoldenRecordStore } from "@suguvisa/golden-records";

const store = new InMemoryGoldenRecordStore();
await store.create({
  tenantId: "tenant-1",
  type: "visa_rule",
  title: "...",
  summary: "...",
  content: "...",
  source: { name: "...", url: "..." },
  citations: [],
  validFrom: "2020-04-01T00:00:00.000Z",
  validUntil: null,
  metadata: {},
});
```

### 埋め込み / Embeddings

- `DeterministicEmbeddingProvider` — 決定的 (テスト用)
- `VertexEmbeddingProvider` — Vertex AI text-embedding-004

```typescript
import {
  DeterministicEmbeddingProvider,
  VertexEmbeddingProvider,
} from "@suguvisa/golden-records";

const embeddings = new VertexEmbeddingProvider({
  projectId: process.env.GCP_PROJECT_ID!,
  location: "asia-northeast1",
  model: "text-embedding-004",
  dimensions: 768,
});
```

### Retriever

`HybridRetriever` は BM25 (via `GoldenRecordStore#keywordSearch`) と Vector Search を Reciprocal Rank Fusion (RRF) で統合する。

```typescript
import { HybridRetriever } from "@suguvisa/golden-records";

const retriever = new HybridRetriever({
  store,
  embeddings,
  // vectorSearch: optional - provide VertexAiVectorSearchProvider in prod
  candidatePerRetriever: 20,
  rrfK: 60,
});

const hits = await retriever.search({
  query: "特定技能 1 号 試験免除",
  topK: 5,
  filter: { tenantId: "tenant-1", includeGlobal: true },
});
```

### プロンプト整形 / Prompt Formatting

```typescript
import { formatHitsForPrompt } from "@suguvisa/golden-records";

const contextBlock = formatHitsForPrompt(hits);
// 番号付きで title / source / valid / content を整形した Markdown
```

## MCP ツールとしての利用 / MCP Tool Usage

`apps/mcp-server` は `suguvisa_golden_records_search` ツールを登録する。デフォルトは InMemory、本番では `setGoldenRecordsContext({ store, retriever })` で差し替える。

## ロードマップ / Roadmap / Peta Jalan

- [x] Phase 2 Task 2.1: Firestore + Vertex AI Vector Search の最小実装
- [ ] Phase 2 Task 2.2: 埋め込み再構築ワーカー (Cloud Functions)
- [ ] Phase 2 Task 2.3: ReRanker (Cohere Rerank / Gemini)
- [ ] Phase 2 Task 2.4: 法改正検知との自動連動
