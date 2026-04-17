import { describe, expect, it } from "vitest";
import { buildBm25Index, bm25Score, tokenize } from "../util/tokenizer.js";

describe("tokenize", () => {
  it("splits latin words on spaces", () => {
    expect(tokenize("Hello World test")).toEqual(["hello", "world", "test"]);
  });

  it("produces bigrams for Japanese", () => {
    const tokens = tokenize("特定技能");
    expect(tokens).toContain("特");
    expect(tokens).toContain("定");
    expect(tokens).toContain("特定");
    expect(tokens).toContain("定技");
    expect(tokens).toContain("技能");
  });

  it("normalizes full-width to half-width", () => {
    expect(tokenize("ＳＳＷ")).toEqual(["ssw"]);
  });

  it("separates Japanese and latin", () => {
    const tokens = tokenize("SSW 特定技能");
    expect(tokens).toContain("ssw");
    expect(tokens).toContain("特定");
  });
});

describe("BM25", () => {
  it("ranks more relevant docs higher", () => {
    const index = buildBm25Index([
      { id: "a", tokens: tokenize("特定技能 1 号 試験免除") },
      { id: "b", tokens: tokenize("年末調整 源泉徴収票 配布") },
      { id: "c", tokens: tokenize("特定技能 試験 合格") },
    ]);
    const scored = bm25Score(index, tokenize("特定技能 試験 免除"));
    expect(scored[0]!.id).toBe("a");
    // b は全く関係しない文書。score が付かないか、c より低い
    const aScore = scored.find((s) => s.id === "a")?.score ?? 0;
    const bScore = scored.find((s) => s.id === "b")?.score ?? 0;
    expect(aScore).toBeGreaterThan(bScore);
  });

  it("returns empty for empty index", () => {
    const index = buildBm25Index([]);
    expect(bm25Score(index, ["foo"])).toEqual([]);
  });
});
