import type {
  EmbeddingProvider,
  GoldenRecord,
  GoldenRecordStore,
  Retriever,
  SearchHit,
  SearchQuery,
  VectorSearchProvider,
} from "../types.js";
import { matchesFilter } from "../stores/in-memory.js";
import { cosineSimilarity } from "../embeddings/deterministic.js";

export interface HybridRetrieverOptions {
  store: GoldenRecordStore;
  embeddings?: EmbeddingProvider;
  /** 外部 Vector Search。未指定なら store.list() から cosine を計算 */
  vectorSearch?: VectorSearchProvider;
  /** keyword / vector の上位何件を考慮するか (default 20) */
  candidatePerRetriever?: number;
  /** RRF の k 定数 (default 60) */
  rrfK?: number;
}

/**
 * Reciprocal Rank Fusion で keyword + vector を統合するハイブリッド retriever
 * Hybrid retriever that fuses keyword + vector via Reciprocal Rank Fusion
 * Retriever hibrida yang menggabungkan keyword + vector melalui Reciprocal Rank Fusion
 */
export class HybridRetriever implements Retriever {
  readonly #store: GoldenRecordStore;
  readonly #embeddings?: EmbeddingProvider;
  readonly #vectorSearch?: VectorSearchProvider;
  readonly #candidatePerRetriever: number;
  readonly #rrfK: number;

  constructor(options: HybridRetrieverOptions) {
    this.#store = options.store;
    this.#embeddings = options.embeddings;
    this.#vectorSearch = options.vectorSearch;
    this.#candidatePerRetriever = options.candidatePerRetriever ?? 20;
    this.#rrfK = options.rrfK ?? 60;
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const topK = query.topK ?? 5;
    const cap = Math.max(topK, this.#candidatePerRetriever);

    // 1. Keyword search
    const keywordHits = await this.#store.keywordSearch({ ...query, topK: cap });

    // 2. Vector search (embedding が無ければスキップ)
    const vectorRanks = this.#embeddings
      ? await this.#vectorSearchInternal(query, cap)
      : new Map<string, { record: GoldenRecord; similarity: number; rank: number }>();

    // 3. RRF で融合
    const scores = new Map<
      string,
      { record: GoldenRecord; score: number; keywordRank: number; vectorRank: number }
    >();

    keywordHits.forEach((hit, idx) => {
      const rank = idx + 1;
      scores.set(hit.record.id, {
        record: hit.record,
        score: 1 / (this.#rrfK + rank),
        keywordRank: rank,
        vectorRank: 0,
      });
    });

    vectorRanks.forEach((v, id) => {
      const existing = scores.get(id);
      const rrfContribution = 1 / (this.#rrfK + v.rank);
      if (existing) {
        existing.score += rrfContribution;
        existing.vectorRank = v.rank;
      } else {
        scores.set(id, {
          record: v.record,
          score: rrfContribution,
          keywordRank: 0,
          vectorRank: v.rank,
        });
      }
    });

    const merged: SearchHit[] = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((m) => ({
        record: m.record,
        score: m.score,
        ranks: { keyword: m.keywordRank, vector: m.vectorRank },
      }));

    return merged;
  }

  async #vectorSearchInternal(
    query: SearchQuery,
    cap: number,
  ): Promise<Map<string, { record: GoldenRecord; similarity: number; rank: number }>> {
    if (!this.#embeddings) return new Map();
    const qVec = await this.#embeddings.embed(query.query);

    // 外部 Vector Search を使う場合
    if (this.#vectorSearch) {
      const hits = await this.#vectorSearch.search(qVec, cap);
      const map = new Map<string, { record: GoldenRecord; similarity: number; rank: number }>();
      let rank = 1;
      for (const h of hits) {
        const record = await this.#store.get(h.id);
        if (!record) continue;
        if (query.filter && !matchesFilter(record, query.filter)) continue;
        map.set(record.id, { record, similarity: h.similarity, rank });
        rank++;
        if (rank > cap) break;
      }
      return map;
    }

    // フォールバック: store から全件取得して cosine 計算
    const all = await this.#store.list(query.filter);
    const scored: Array<{ record: GoldenRecord; similarity: number }> = [];
    for (const record of all) {
      if (!record.embedding) continue;
      scored.push({ record, similarity: cosineSimilarity(qVec, record.embedding) });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    const map = new Map<string, { record: GoldenRecord; similarity: number; rank: number }>();
    scored.slice(0, cap).forEach((s, idx) => {
      map.set(s.record.id, { record: s.record, similarity: s.similarity, rank: idx + 1 });
    });
    return map;
  }
}
