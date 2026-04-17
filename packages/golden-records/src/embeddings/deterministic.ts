import { createHash } from "node:crypto";
import type { EmbeddingProvider } from "../types.js";
import { tokenize } from "../util/tokenizer.js";

/**
 * テスト用の決定的な埋め込みプロバイダ
 * Deterministic embedding provider for testing
 * Penyedia embedding deterministik untuk pengujian
 *
 * 同じ入力は同じ出力を返す。本番利用不可。
 * 方式: token を hash して bucket に加算し、L2 正規化。
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;

  constructor(dimensions = 64) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const tokens = tokenize(text);
    const vec = new Array<number>(this.dimensions).fill(0);
    for (const t of tokens) {
      const hash = createHash("sha256").update(t).digest();
      const idx = hash.readUInt32BE(0) % this.dimensions;
      const sign = hash[4]! % 2 === 0 ? 1 : -1;
      vec[idx] += sign;
    }
    return l2Normalize(vec);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return vec;
  return vec.map((x) => x / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("vector dimension mismatch");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
