/**
 * Golden Records 型定義
 * Golden Records type definitions
 * Definisi tipe Golden Records
 */

/**
 * Golden Record のタイプ
 * Type of Golden Record
 * Jenis Golden Record
 */
export type GoldenRecordType =
  | "visa_rule"
  | "official_document"
  | "industry_field"
  | "nationality"
  | "company_master"
  | "case_precedent"
  | "form_template"
  | "faq";

export const GOLDEN_RECORD_TYPES: readonly GoldenRecordType[] = [
  "visa_rule",
  "official_document",
  "industry_field",
  "nationality",
  "company_master",
  "case_precedent",
  "form_template",
  "faq",
] as const;

/**
 * 引用 / 参照先
 * Citation / reference
 * Kutipan / referensi
 */
export interface Citation {
  /** 内部 Golden Record への参照 */
  recordId?: string;
  /** 参照元 (例: "入管法施行規則 第 19 条") */
  source: string;
  /** 公式 URL */
  url?: string;
  /** 該当する引用文 */
  quote?: string;
}

/**
 * ソース情報
 * Source information
 * Informasi sumber
 */
export interface RecordSource {
  name: string;
  url?: string;
  /** ISO 8601 */
  retrievedAt?: string;
}

/**
 * Golden Record 本体
 * Golden Record entity
 * Entitas Golden Record
 */
export interface GoldenRecord {
  id: string;
  /** テナント ID。グローバル共有は "__global__" */
  tenantId: string;
  type: GoldenRecordType;
  title: string;
  /** Markdown 本文 */
  content: string;
  /** 1-2 文のサマリ。embedding 対象 */
  summary: string;
  source: RecordSource;
  citations: Citation[];
  /** ISO 8601 */
  validFrom: string;
  /** ISO 8601, null = 無期限 */
  validUntil: string | null;
  /** 1 始まりの連番 */
  version: number;
  metadata: Record<string, unknown>;
  /** content + summary の SHA-256 (hex) */
  checksum: string;
  createdAt: string;
  updatedAt: string;
  /** ベクトル埋め込み (生成済みの場合) */
  embedding?: number[];
}

/**
 * グローバル共有テナント識別子
 * Global shared tenant identifier
 * Identifier tenant bersama global
 */
export const GLOBAL_TENANT_ID = "__global__";

/**
 * 新規 Record 作成用 input 型
 * Input type for creating a new record
 * Tipe input untuk membuat record baru
 */
export type CreateGoldenRecordInput = Omit<
  GoldenRecord,
  "id" | "version" | "checksum" | "createdAt" | "updatedAt" | "embedding"
> & {
  /** オプション。指定しない場合は UUID を生成 */
  id?: string;
};

/**
 * 更新用 input 型
 * Input type for updates
 * Tipe input untuk pembaruan
 */
export type UpdateGoldenRecordInput = Partial<
  Omit<GoldenRecord, "id" | "version" | "checksum" | "createdAt" | "updatedAt">
>;

/**
 * クエリフィルター
 * Query filter
 * Filter kueri
 */
export interface RecordFilter {
  tenantId?: string;
  includeGlobal?: boolean;
  types?: GoldenRecordType[];
  /** ISO 8601 - この時点で有効なレコードだけ (default: now) */
  effectiveAt?: string;
  /** metadata の部分一致 (equality) */
  metadataEquals?: Record<string, unknown>;
}

/**
 * 検索クエリ
 * Search query
 * Kueri pencarian
 */
export interface SearchQuery {
  /** 自然言語クエリ */
  query: string;
  /** 返却件数 (default 5, max 20) */
  topK?: number;
  filter?: RecordFilter;
}

/**
 * 検索結果 1 件
 * Single search hit
 * Hasil pencarian tunggal
 */
export interface SearchHit {
  record: GoldenRecord;
  /** 最終スコア (higher = more relevant) */
  score: number;
  /** 各 retriever の rank (1 始まり, 0 = 該当なし) */
  ranks: {
    keyword: number;
    vector: number;
  };
}

/**
 * Retriever インターフェース
 * Retriever interface
 * Antarmuka retriever
 */
export interface Retriever {
  search(query: SearchQuery): Promise<SearchHit[]>;
}

/**
 * ストア インターフェース (CRUD)
 * Store interface (CRUD)
 * Antarmuka store (CRUD)
 */
export interface GoldenRecordStore {
  get(id: string): Promise<GoldenRecord | null>;
  create(input: CreateGoldenRecordInput): Promise<GoldenRecord>;
  update(id: string, patch: UpdateGoldenRecordInput): Promise<GoldenRecord>;
  delete(id: string): Promise<void>;
  list(filter?: RecordFilter): Promise<GoldenRecord[]>;
  /** キーワード検索。BM25 相当。score 降順 */
  keywordSearch(query: SearchQuery): Promise<SearchHit[]>;
}

/**
 * 埋め込みプロバイダ
 * Embedding provider
 * Penyedia embedding
 */
export interface EmbeddingProvider {
  /** 入力テキストをベクトル化 (次元は provider 固有) */
  embed(text: string): Promise<number[]>;
  /** バッチ埋め込み */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** 出力ベクトルの次元数 */
  readonly dimensions: number;
}

/**
 * ベクトル検索プロバイダ
 * Vector search provider
 * Penyedia pencarian vektor
 */
export interface VectorSearchProvider {
  upsert(records: Array<{ id: string; embedding: number[] }>): Promise<void>;
  remove(ids: string[]): Promise<void>;
  /** クエリベクトルで top-K の id とスコアを返す */
  search(embedding: number[], topK: number): Promise<Array<{ id: string; similarity: number }>>;
}
