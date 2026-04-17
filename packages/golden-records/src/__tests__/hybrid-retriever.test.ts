import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryGoldenRecordStore } from "../stores/in-memory.js";
import { DeterministicEmbeddingProvider } from "../embeddings/deterministic.js";
import { HybridRetriever } from "../retrievers/hybrid.js";
import type { CreateGoldenRecordInput, GoldenRecord } from "../types.js";

async function setup() {
  const store = new InMemoryGoldenRecordStore();
  const embeddings = new DeterministicEmbeddingProvider(64);

  async function seed(overrides: Partial<CreateGoldenRecordInput>): Promise<GoldenRecord> {
    const created = await store.create({
      tenantId: "tenant-1",
      type: "visa_rule",
      title: overrides.title ?? "title",
      content: overrides.content ?? "",
      summary: overrides.summary ?? "",
      source: { name: "src" },
      citations: [],
      validFrom: "2020-01-01T00:00:00.000Z",
      validUntil: null,
      metadata: {},
      ...overrides,
    });
    const embedding = await embeddings.embed(`${created.title}\n${created.summary}\n${created.content}`);
    return (await store.update(created.id, { ...created, embedding })) as GoldenRecord & {
      embedding: number[];
    };
  }

  await seed({
    title: "特定技能 1 号 技能試験免除",
    summary: "技能実習 2 号を良好に修了した場合は試験が免除される",
    content: "技能実習 2 号を良好に修了した場合、技能試験と日本語試験が免除される。",
  });
  await seed({
    title: "定期届出の提出期限",
    summary: "毎年 4/1 から 5/31 に提出する定期届出",
    content: "定期届出は毎年 4 月から 5 月末までに提出する必要がある。",
  });
  await seed({
    title: "随時届出",
    summary: "事由発生から 14 日以内に提出する随時届出",
    content: "雇用契約の変更などがあった場合、14 日以内に随時届出を行う。",
  });

  return { store, embeddings };
}

describe("HybridRetriever", () => {
  let store: InMemoryGoldenRecordStore;
  let embeddings: DeterministicEmbeddingProvider;

  beforeEach(async () => {
    const ctx = await setup();
    store = ctx.store;
    embeddings = ctx.embeddings;
  });

  it("returns top-K hits fused with RRF", async () => {
    const retriever = new HybridRetriever({ store, embeddings });
    const hits = await retriever.search({
      query: "技能試験 免除",
      topK: 2,
      filter: { tenantId: "tenant-1" },
    });
    expect(hits.length).toBeLessThanOrEqual(2);
    expect(hits[0]!.record.title).toContain("技能試験免除");
    expect(hits[0]!.score).toBeGreaterThan(0);
  });

  it("falls back to keyword-only when no embeddings supplied", async () => {
    const retriever = new HybridRetriever({ store });
    const hits = await retriever.search({
      query: "届出",
      topK: 2,
      filter: { tenantId: "tenant-1" },
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.ranks.keyword).toBe(1);
    expect(hits[0]!.ranks.vector).toBe(0);
  });

  it("respects tenant filter", async () => {
    await store.create({
      tenantId: "tenant-2",
      type: "visa_rule",
      title: "技能試験免除",
      content: "別テナントのレコード",
      summary: "leak test",
      source: { name: "src" },
      citations: [],
      validFrom: "2020-01-01T00:00:00.000Z",
      validUntil: null,
      metadata: {},
    });
    const retriever = new HybridRetriever({ store, embeddings });
    const hits = await retriever.search({
      query: "技能試験 免除",
      topK: 5,
      filter: { tenantId: "tenant-1" },
    });
    for (const h of hits) {
      expect(h.record.tenantId).toBe("tenant-1");
    }
  });
});
