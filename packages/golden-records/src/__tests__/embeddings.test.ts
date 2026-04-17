import { describe, expect, it } from "vitest";
import { DeterministicEmbeddingProvider, cosineSimilarity } from "../embeddings/deterministic.js";

describe("DeterministicEmbeddingProvider", () => {
  it("returns a vector of the configured dimension", async () => {
    const p = new DeterministicEmbeddingProvider(32);
    const v = await p.embed("hello world");
    expect(v).toHaveLength(32);
  });

  it("is deterministic", async () => {
    const p = new DeterministicEmbeddingProvider(64);
    const a = await p.embed("特定技能 試験 免除");
    const b = await p.embed("特定技能 試験 免除");
    expect(a).toEqual(b);
  });

  it("assigns higher similarity to semantically similar queries", async () => {
    const p = new DeterministicEmbeddingProvider(128);
    const q = await p.embed("特定技能 試験 免除");
    const near = await p.embed("特定技能 1 号 試験免除 技能実習");
    const far = await p.embed("定期届出 4 月 5 月");
    const simNear = cosineSimilarity(q, near);
    const simFar = cosineSimilarity(q, far);
    expect(simNear).toBeGreaterThan(simFar);
  });

  it("batch embedding returns correct shape", async () => {
    const p = new DeterministicEmbeddingProvider(16);
    const vecs = await p.embedBatch(["a", "b", "c"]);
    expect(vecs).toHaveLength(3);
    expect(vecs[0]!).toHaveLength(16);
  });

  it("normalizes to L2 unit length", async () => {
    const p = new DeterministicEmbeddingProvider(64);
    const v = await p.embed("unit length test");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });
  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 0], [1])).toThrow();
  });
});
