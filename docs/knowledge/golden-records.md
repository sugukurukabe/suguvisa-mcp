# Golden Records 設計 / Golden Records Design / Desain Golden Records

> Phase 2 Task 2.1
> `@suguvisa/golden-records` — ビザ業務の「信頼できるナレッジベース」

## 概要 / Overview / Ikhtisar

Golden Records は、LLM エージェント（Claude / GPT / Gemini）が参照する「検証済みの知識」の正規化された保管場所。

**目的**
- LLM のハルシネーションを防ぐ（根拠のある情報のみ返す）
- 引用可能な形で情報を提供する（`source`, `citation` を必須）
- バージョニングと `valid_from` / `valid_until` で法改正を追跡
- テナント間で共有知識（公式文書・ルール）と個別知識（案件履歴）を分離

**構成**
- Firestore = 正規化されたドキュメントストア（CRUD + スナップショット検索）
- Vertex AI Vector Search = セマンティック検索（ANN、top-K 類似度）
- Hybrid Retriever = BM25 + Vector を Reciprocal Rank Fusion (RRF) で統合

---

## スキーマ / Schema

```typescript
type GoldenRecordType =
  | "visa_rule"         // 入管ルール（例: 特定技能 1 号の技能試験免除条件）
  | "official_document" // 入管 / 厚労省の公式通達
  | "industry_field"    // 特定産業分野マスタ
  | "nationality"       // 国コードマスタ
  | "company_master"    // 派遣先マスタ（公開情報のみ）
  | "case_precedent"    // 過去事例（匿名化済み）
  | "form_template"     // 入管様式の雛形
  | "faq";              // よくある質問と回答

interface GoldenRecord {
  id: string;                    // UUID
  tenantId: string;              // グローバル共有は "__global__"
  type: GoldenRecordType;
  title: string;                 // 日本語タイトル
  content: string;               // Markdown
  summary: string;               // 1-2 文サマリ（Vector embedding 対象）
  source: {
    name: string;                // e.g. "入管法 第 2 条の 4"
    url?: string;                // 公式 URL
    retrievedAt?: string;        // ISO 8601
  };
  citations: Citation[];         // 参照先リスト
  validFrom: string;             // ISO 8601
  validUntil: string | null;     // ISO 8601, null = 無期限
  version: number;               // 連番 (1 から)
  metadata: Record<string, unknown>;
  checksum: string;              // content の SHA-256 (32 hex)
  createdAt: string;
  updatedAt: string;
  embedding?: number[];          // 768 次元 (text-embedding-004)
}

interface Citation {
  recordId?: string;             // 他の Golden Record への内部参照
  source: string;                // 例: "入管法施行規則 第 19 条"
  url?: string;
  quote?: string;
}
```

---

## アーキテクチャ / Architecture / Arsitektur

```
┌──────────────────────────────────────────────────────────────────┐
│                       LLM Agent (Claude/GPT)                      │
└──────────────────────┬───────────────────────────────────────────┘
                       │ MCP tool: search_golden_records
                       ↓
┌──────────────────────────────────────────────────────────────────┐
│                    @suguvisa/golden-records                       │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ HybridRetriever│→ │ KeywordRetriever │  │ VectorRetriever │   │
│  │    (RRF)       │  │   (Firestore)    │  │   (Vertex AI)   │   │
│  └────────────────┘  └──────────────────┘  └─────────────────┘   │
│          ↓                                                         │
│   ReRanker (optional)                                              │
└──────────────────────────────────────────────────────────────────┘
                       ↓
               Top-K records with citations
```

### Retrieval アルゴリズム / Retrieval Algorithm / Algoritma Retrieval

1. **クエリ正規化**: unicode NFKC, 全角→半角, 同義語展開（「特定技能」⇄「SSW」）
2. **並列検索**:
   - BM25 (Firestore の部分一致 + `title_bigram` / `content_bigram` インデックス) → top 20
   - Vector (Vertex AI Vector Search, cosine sim) → top 20
3. **Reciprocal Rank Fusion**: 以下の式で最終スコアを計算
   ```
   score(doc) = Σ 1 / (k + rank_i(doc))    (k=60 が定番)
   ```
4. **フィルタリング**:
   - `tenantId IN (userTenantId, "__global__")`
   - `validUntil IS NULL OR validUntil >= now()`
   - type フィルタ（ユーザー指定）
5. **Top-K** を返す（デフォルト 5）。各結果は citation 付き

---

## プロンプト統合 / Prompt Integration / Integrasi Prompt

LLM に渡す際の形式（推奨）:

```
[Context from Golden Records]
1. **{{title}}** (id={{id}}, version={{version}})
   Source: {{source.name}} ({{source.url}})
   Valid: {{validFrom}} – {{validUntil ?? "present"}}

   {{content}}

   ---
2. ...

[Instructions]
回答には必ず上記 Context からの引用を含め、[1], [2] のように番号で参照してください。
Context に含まれない情報は「根拠がない」と回答してください。
```

---

## 実装の段階 / Implementation Phases / Fase Implementasi

### MVP (Phase 2 Task 2.1)
- [x] 型定義（`GoldenRecord`, `Citation`, retrieve の入出力）
- [x] `InMemoryStore` — テスト用の完全実装
- [x] `FirestoreStore` — 本番用アダプタ（ioc 注入で FirebaseApp を受ける）
- [x] `VertexEmbeddingProvider` — `text-embedding-004` 呼び出し
- [x] `HybridRetriever` — RRF で結合
- [x] MCP ツール `search_golden_records`（scope: `knowledge:read`）
- [x] Vitest（型、retriever、RRF、Firestore モック）
- [x] Terraform: Firestore DB + Vector Search index draft
- [x] Auth0 Action による scope の自動付与（既存の仕組みを活用）

### 次フェーズ (将来)
- [ ] ベクトル index の自動更新ワーカー（Cloud Functions）
- [ ] 法改正検知のバッチ（`law-updates.ts` と連携）
- [ ] ReRanker（Cohere Rerank / Gemini）
- [ ] 利用ログから Golden Record を提案する逆引き系

---

## セキュリティとコンプライアンス / Security & Compliance / Keamanan & Kepatuhan

- **PII を含めない**: Golden Records は「公開可能な知識」のみ
  - 個人情報を含む案件データは `case_precedent` として **匿名化** したうえで格納
  - マスキング規則は `@suguvisa/core/pii` を使用
- **tenantId 境界**: 必ず `tenantId` フィルタを retrieve に適用
  - 検証されていないクエリで他テナントのデータが漏れないように retriever 層で enforce
- **バージョニング**: `version` は単調増加。古いバージョンは論理削除で保持（監査用）

---

## オープン事項 / Open Items / Item Terbuka

- [ ] Vector index の再構築トリガー（日次 vs リアルタイム）
- [ ] `__global__` テナントの書き込み権限（現状: Admin のみ）
- [ ] 日本語 BM25 のトークナイザー（形態素解析 or bigram）
- [ ] retrieve 結果の監査ログ形式
