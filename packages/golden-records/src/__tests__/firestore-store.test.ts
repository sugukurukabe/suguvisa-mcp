import { describe, expect, it, beforeEach } from "vitest";
import {
  FirestoreGoldenRecordStore,
  type CollectionLike,
  type DocLike,
  type DocSnapshot,
  type FirestoreLike,
} from "../stores/firestore.js";
import type { CreateGoldenRecordInput } from "../types.js";

/**
 * 簡易的な Firestore モック
 * Lightweight Firestore mock
 * Mock Firestore sederhana
 */
class MockFirestore implements FirestoreLike {
  collections = new Map<string, MockCollection>();
  collection(path: string): CollectionLike {
    let coll = this.collections.get(path);
    if (!coll) {
      coll = new MockCollection();
      this.collections.set(path, coll);
    }
    return coll;
  }
}

class MockCollection implements CollectionLike {
  docs = new Map<string, Record<string, unknown>>();
  #filters: Array<(data: Record<string, unknown>) => boolean> = [];
  #limit?: number;

  doc(id: string): DocLike {
    return {
      get: async () => ({
        id,
        exists: this.docs.has(id),
        data: () => this.docs.get(id),
      }),
      set: async (data) => {
        this.docs.set(id, { ...data });
      },
      update: async (data) => {
        const cur = this.docs.get(id) ?? {};
        this.docs.set(id, { ...cur, ...data });
      },
      delete: async () => {
        this.docs.delete(id);
      },
    };
  }

  where(field: string, op: string, value: unknown): CollectionLike {
    const clone = this.#clone();
    clone.#filters.push((data) => {
      if (op === "==") return data[field] === value;
      return true;
    });
    return clone;
  }

  limit(n: number): CollectionLike {
    const clone = this.#clone();
    clone.#limit = n;
    return clone;
  }

  async get(): Promise<{ docs: DocSnapshot[] }> {
    let entries = Array.from(this.docs.entries());
    if (this.#filters.length > 0) {
      entries = entries.filter(([, data]) => this.#filters.every((f) => f(data)));
    }
    if (this.#limit) entries = entries.slice(0, this.#limit);
    return {
      docs: entries.map(([id, data]) => ({
        id,
        exists: true,
        data: () => data,
      })),
    };
  }

  #clone(): MockCollection {
    const c = new MockCollection();
    c.docs = this.docs;
    c.#filters = [...this.#filters];
    c.#limit = this.#limit;
    return c;
  }
}

function sampleInput(overrides: Partial<CreateGoldenRecordInput> = {}): CreateGoldenRecordInput {
  return {
    tenantId: "tenant-1",
    type: "visa_rule",
    title: "title",
    content: "content",
    summary: "summary",
    source: { name: "src" },
    citations: [],
    validFrom: "2020-01-01T00:00:00.000Z",
    validUntil: null,
    metadata: {},
    ...overrides,
  };
}

describe("FirestoreGoldenRecordStore", () => {
  let firestore: MockFirestore;
  let store: FirestoreGoldenRecordStore;

  beforeEach(() => {
    firestore = new MockFirestore();
    store = new FirestoreGoldenRecordStore({ firestore });
  });

  it("create then get returns the record", async () => {
    const created = await store.create(sampleInput({ title: "Firestore round trip" }));
    const got = await store.get(created.id);
    expect(got?.title).toBe("Firestore round trip");
    expect(got?.version).toBe(1);
  });

  it("update increments version and recomputes checksum", async () => {
    const created = await store.create(sampleInput());
    const updated = await store.update(created.id, {
      content: "new content",
      summary: "new summary",
    });
    expect(updated.version).toBe(2);
    expect(updated.checksum).not.toBe(created.checksum);
  });

  it("list filters by tenant", async () => {
    await store.create(sampleInput({ tenantId: "tenant-1" }));
    await store.create(sampleInput({ tenantId: "tenant-2", title: "other" }));

    const t1 = await store.list({ tenantId: "tenant-1" });
    expect(t1.map((r) => r.tenantId)).toEqual(["tenant-1"]);
  });

  it("keywordSearch ranks relevant first", async () => {
    await store.create(sampleInput({ title: "試験 免除", summary: "exam waiver" }));
    await store.create(sampleInput({ title: "届出 期限", summary: "notification due" }));
    const hits = await store.keywordSearch({
      query: "試験 免除",
      filter: { tenantId: "tenant-1" },
    });
    expect(hits[0]?.record.title).toBe("試験 免除");
  });

  it("delete removes record", async () => {
    const created = await store.create(sampleInput());
    await store.delete(created.id);
    expect(await store.get(created.id)).toBeNull();
  });
});
