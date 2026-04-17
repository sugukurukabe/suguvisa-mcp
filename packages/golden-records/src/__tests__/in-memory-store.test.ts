import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryGoldenRecordStore } from "../stores/in-memory.js";
import { GLOBAL_TENANT_ID } from "../types.js";
import type { CreateGoldenRecordInput } from "../types.js";

function sampleInput(overrides: Partial<CreateGoldenRecordInput> = {}): CreateGoldenRecordInput {
  return {
    tenantId: "tenant-1",
    type: "visa_rule",
    title: "特定技能 1 号 技能試験免除",
    content: "技能実習 2 号を良好に修了した場合、技能試験と日本語試験が免除される。",
    summary: "技能実習 2 号修了者は試験免除",
    source: { name: "入管庁 FAQ", url: "https://example.gov/faq" },
    citations: [{ source: "入管法施行規則 第 19 条" }],
    validFrom: "2020-04-01T00:00:00.000Z",
    validUntil: null,
    metadata: { category: "exam-exemption" },
    ...overrides,
  };
}

describe("InMemoryGoldenRecordStore", () => {
  let store: InMemoryGoldenRecordStore;
  beforeEach(() => {
    store = new InMemoryGoldenRecordStore();
  });

  it("creates a record with version 1 and a checksum", async () => {
    const created = await store.create(sampleInput());
    expect(created.version).toBe(1);
    expect(created.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(created.id).toBeDefined();
    expect(created.createdAt).toBeDefined();
  });

  it("get returns stored record", async () => {
    const created = await store.create(sampleInput());
    const got = await store.get(created.id);
    expect(got).toEqual(created);
  });

  it("update increments version and recomputes checksum", async () => {
    const created = await store.create(sampleInput());
    const updated = await store.update(created.id, {
      content: "更新された内容です。",
      summary: "updated",
    });
    expect(updated.version).toBe(2);
    expect(updated.checksum).not.toBe(created.checksum);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it("delete removes record", async () => {
    const created = await store.create(sampleInput());
    await store.delete(created.id);
    expect(await store.get(created.id)).toBeNull();
  });

  it("list filters by tenant and global", async () => {
    await store.create(sampleInput({ tenantId: "tenant-1" }));
    await store.create(sampleInput({ tenantId: "tenant-2", title: "t2" }));
    await store.create(sampleInput({ tenantId: GLOBAL_TENANT_ID, title: "global" }));

    const t1 = await store.list({ tenantId: "tenant-1" });
    expect(t1).toHaveLength(1);

    const t1Plus = await store.list({ tenantId: "tenant-1", includeGlobal: true });
    expect(t1Plus.map((r) => r.tenantId).sort()).toEqual([GLOBAL_TENANT_ID, "tenant-1"]);
  });

  it("list filters by type and effectiveAt", async () => {
    await store.create(
      sampleInput({
        type: "visa_rule",
        validFrom: "2020-01-01T00:00:00.000Z",
        validUntil: "2025-01-01T00:00:00.000Z",
      }),
    );
    await store.create(
      sampleInput({ type: "faq", title: "faq", validFrom: "2020-01-01T00:00:00.000Z" }),
    );

    const rules = await store.list({
      types: ["visa_rule"],
      effectiveAt: "2024-06-01T00:00:00.000Z",
    });
    expect(rules).toHaveLength(1);

    const currentlyValid = await store.list({ effectiveAt: "2026-01-01T00:00:00.000Z" });
    expect(currentlyValid.map((r) => r.type)).toEqual(["faq"]);
  });

  it("keywordSearch ranks relevant documents first", async () => {
    await store.create(sampleInput({ title: "特定技能 1 号 試験免除", content: "免除条件" }));
    await store.create(
      sampleInput({
        title: "定期届出のやり方",
        content: "毎年 4 月から 5 月に届出をする",
        summary: "定期届出",
        metadata: {},
      }),
    );
    const hits = await store.keywordSearch({
      query: "試験 免除",
      filter: { tenantId: "tenant-1" },
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.record.title).toContain("試験免除");
    expect(hits[0]!.ranks.keyword).toBe(1);
  });

  it("keywordSearch honors filter", async () => {
    await store.create(sampleInput({ tenantId: "tenant-1", title: "tenant-1 doc" }));
    await store.create(sampleInput({ tenantId: "tenant-2", title: "tenant-2 doc" }));
    const hits = await store.keywordSearch({
      query: "doc",
      filter: { tenantId: "tenant-1" },
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.record.tenantId).toBe("tenant-1");
  });
});
