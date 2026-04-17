import { randomUUID } from "node:crypto";
import type {
  CreateGoldenRecordInput,
  GoldenRecord,
  GoldenRecordStore,
  RecordFilter,
  SearchHit,
  SearchQuery,
  UpdateGoldenRecordInput,
} from "../types.js";
import { GLOBAL_TENANT_ID } from "../types.js";
import { computeChecksum } from "../util/checksum.js";
import { bm25Score, buildBm25Index, tokenize } from "../util/tokenizer.js";
import { matchesFilter } from "./in-memory.js";

/**
 * Firestore に対する最小のドキュメント操作インターフェース
 * Minimal Firestore-like document interface
 * Antarmuka dokumen Firestore minimal
 *
 * @google-cloud/firestore の Firestore クラスを直接 import しない。
 * これにより optional peer dependency として扱え、テストでも差し替え可能。
 */
export interface FirestoreLike {
  collection(path: string): CollectionLike;
}

export interface CollectionLike {
  doc(id: string): DocLike;
  get(): Promise<{ docs: Array<DocSnapshot> }>;
  where(field: string, op: string, value: unknown): CollectionLike;
  limit(n: number): CollectionLike;
}

export interface DocLike {
  get(): Promise<DocSnapshot>;
  set(data: Record<string, unknown>): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface DocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface FirestoreGoldenRecordStoreOptions {
  firestore: FirestoreLike;
  /** デフォルト: "golden_records" */
  collectionName?: string;
}

/**
 * Firestore 実装の GoldenRecordStore
 * Firestore-backed GoldenRecordStore implementation
 * Implementasi GoldenRecordStore yang didukung Firestore
 */
export class FirestoreGoldenRecordStore implements GoldenRecordStore {
  readonly #firestore: FirestoreLike;
  readonly #collectionName: string;

  constructor(options: FirestoreGoldenRecordStoreOptions) {
    this.#firestore = options.firestore;
    this.#collectionName = options.collectionName ?? "golden_records";
  }

  #collection(): CollectionLike {
    return this.#firestore.collection(this.#collectionName);
  }

  async get(id: string): Promise<GoldenRecord | null> {
    const snap = await this.#collection().doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;
    return { ...(data as unknown as GoldenRecord), id };
  }

  async create(input: CreateGoldenRecordInput): Promise<GoldenRecord> {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    const record: GoldenRecord = {
      ...input,
      id,
      version: 1,
      checksum: computeChecksum(input.content, input.summary),
      createdAt: now,
      updatedAt: now,
    };
    await this.#collection().doc(id).set(serialize(record));
    return record;
  }

  async update(id: string, patch: UpdateGoldenRecordInput): Promise<GoldenRecord> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Golden Record not found: ${id}`);
    const merged: GoldenRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    merged.checksum = computeChecksum(merged.content, merged.summary);
    await this.#collection().doc(id).set(serialize(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    await this.#collection().doc(id).delete();
  }

  async list(filter: RecordFilter = {}): Promise<GoldenRecord[]> {
    let q: CollectionLike = this.#collection();
    if (filter.tenantId !== undefined && !filter.includeGlobal) {
      q = q.where("tenantId", "==", filter.tenantId);
    }
    if (filter.types && filter.types.length === 1) {
      q = q.where("type", "==", filter.types[0]);
    }
    const snap = await q.get();
    const records = snap.docs
      .map((d) => ({ ...(d.data() as unknown as GoldenRecord), id: d.id }))
      .filter((r) => matchesFilter(r, filter));
    return records;
  }

  async keywordSearch(query: SearchQuery): Promise<SearchHit[]> {
    // Firestore はフルテキスト検索を持たないため、candidate を list() で取得し
    // in-process で BM25 を計算する。大規模な場合は Vector Search と組み合わせるのが前提。
    const records = await this.list(query.filter);
    if (records.length === 0) return [];
    const docs = records.map((r) => ({
      id: r.id,
      tokens: tokenize(`${r.title}\n${r.summary}\n${r.content}`),
    }));
    const index = buildBm25Index(docs);
    const qTokens = tokenize(query.query);
    const scored = bm25Score(index, qTokens).slice(0, query.topK ?? 5);
    const recordMap = new Map(records.map((r) => [r.id, r]));
    return scored.map((s, idx) => ({
      record: recordMap.get(s.id)!,
      score: s.score,
      ranks: { keyword: idx + 1, vector: 0 },
    }));
  }
}

function serialize(record: GoldenRecord): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  // embedding は Vector Search 側で管理するため、Firestore に大きな配列を書かない
  delete out.embedding;
  return out;
}
