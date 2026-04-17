import { describe, expect, it } from "vitest";
import { formatHitsForPrompt } from "../format.js";
import type { SearchHit } from "../types.js";

const hit: SearchHit = {
  record: {
    id: "abc-123",
    tenantId: "tenant-1",
    type: "visa_rule",
    title: "試験免除ルール",
    content: "技能実習 2 号修了者は試験免除",
    summary: "試験免除",
    source: { name: "入管 FAQ", url: "https://example.com" },
    citations: [],
    validFrom: "2020-04-01T00:00:00.000Z",
    validUntil: null,
    version: 3,
    metadata: {},
    checksum: "x".repeat(64),
    createdAt: "2020-04-01T00:00:00.000Z",
    updatedAt: "2020-04-01T00:00:00.000Z",
  },
  score: 0.8,
  ranks: { keyword: 1, vector: 1 },
};

describe("formatHitsForPrompt", () => {
  it("produces numbered context blocks", () => {
    const out = formatHitsForPrompt([hit, hit]);
    expect(out).toContain("[1]");
    expect(out).toContain("[2]");
    expect(out).toContain("試験免除ルール");
    expect(out).toContain("https://example.com");
    expect(out).toContain("id=abc-123");
    expect(out).toContain("version=3");
  });

  it("handles empty input", () => {
    expect(formatHitsForPrompt([])).toContain("見つかりませんでした");
  });
});
