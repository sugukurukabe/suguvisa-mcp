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

/**
 * テスト/開発用のメモリ内ストア
 * In-memory store for testing / development
 * Store dalam memori untuk pengujian / pengembangan
 */
export class InMemoryGoldenRecordStore implements GoldenRecordStore {
  #records = new Map<string, GoldenRecord>();

  async get(id: string): Promise<GoldenRecord | null> {
    return this.#records.get(id) ?? null;
  }

  async create(input: CreateGoldenRecordInput): Promise<GoldenRecord> {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    if (this.#records.has(id)) {
      throw new Error(`Golden Record already exists: ${id}`);
    }
    const record: GoldenRecord = {
      ...input,
      id,
      version: 1,
      checksum: computeChecksum(input.content, input.summary),
      createdAt: now,
      updatedAt: now,
    };
    this.#records.set(id, record);
    return record;
  }

  async update(id: string, patch: UpdateGoldenRecordInput): Promise<GoldenRecord> {
    const existing = this.#records.get(id);
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
    this.#records.set(id, merged);
    return merged;
  }

  async delete(id: string): Promise<void> {
    this.#records.delete(id);
  }

  async list(filter: RecordFilter = {}): Promise<GoldenRecord[]> {
    return Array.from(this.#records.values()).filter((r) => matchesFilter(r, filter));
  }

  async keywordSearch(query: SearchQuery): Promise<SearchHit[]> {
    const filter = query.filter ?? {};
    const docs = (await this.list(filter)).map((r) => ({
      id: r.id,
      tokens: tokenize(`${r.title}\n${r.summary}\n${r.content}`),
    }));
    if (docs.length === 0) return [];
    const index = buildBm25Index(docs);
    const qTokens = tokenize(query.query);
    const scored = bm25Score(index, qTokens).slice(0, query.topK ?? 5);
    return scored.map((s, idx) => {
      const record = this.#records.get(s.id)!;
      return {
        record,
        score: s.score,
        ranks: { keyword: idx + 1, vector: 0 },
      };
    });
  }

  /** テスト用: 全件クリア */
  clear(): void {
    this.#records.clear();
  }

  /** テスト用: 直接挿入 (version など既に決まっているレコードを格納) */
  seed(records: GoldenRecord[]): void {
    for (const r of records) this.#records.set(r.id, r);
  }
}

export function matchesFilter(record: GoldenRecord, filter: RecordFilter): boolean {
  if (filter.tenantId !== undefined) {
    if (filter.includeGlobal) {
      if (record.tenantId !== filter.tenantId && record.tenantId !== GLOBAL_TENANT_ID) {
        return false;
      }
    } else if (record.tenantId !== filter.tenantId) {
      return false;
    }
  }
  if (filter.types && filter.types.length > 0 && !filter.types.includes(record.type)) {
    return false;
  }
  const effectiveAt = filter.effectiveAt ?? new Date().toISOString();
  if (record.validFrom > effectiveAt) return false;
  if (record.validUntil !== null && record.validUntil < effectiveAt) return false;
  if (filter.metadataEquals) {
    for (const [k, v] of Object.entries(filter.metadataEquals)) {
      if (record.metadata[k] !== v) return false;
    }
  }
  return true;
}
