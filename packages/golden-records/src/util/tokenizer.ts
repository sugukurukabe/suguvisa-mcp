/**
 * 日本語対応の軽量トークナイザー
 * Lightweight Japanese-aware tokenizer
 * Tokenizer ringan yang mendukung bahasa Jepang
 *
 * 形態素解析を使わず、以下の戦略を組み合わせる:
 * - ラテン文字/数字: スペース + 英数記号区切り
 * - CJK: bigram (2 文字ずつ)
 * - 全角→半角正規化 (NFKC)
 *
 * 本番で日本語検索精度を上げたい場合は kuromoji への差し替えを検討。
 */

const CJK_RANGE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function isCjkChar(ch: string): boolean {
  return CJK_RANGE.test(ch);
}

/**
 * 文字列を検索用トークン列に変換
 * Convert a string to a list of search tokens
 * Mengubah string menjadi daftar token pencarian
 */
export function tokenize(input: string): string[] {
  if (!input) return [];
  const normalized = input.normalize("NFKC").toLowerCase();
  const tokens: string[] = [];
  const latinBuffer: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i]!;
    if (isCjkChar(ch)) {
      if (latinBuffer.length > 0) {
        flushLatin(latinBuffer, tokens);
      }
      // bigram
      tokens.push(ch);
      const next = normalized[i + 1];
      if (next && isCjkChar(next)) {
        tokens.push(ch + next);
      }
      i++;
      continue;
    }
    if (/[\s.,;:!?()\[\]{}"'、。「」『』・]/u.test(ch)) {
      if (latinBuffer.length > 0) {
        flushLatin(latinBuffer, tokens);
      }
      i++;
      continue;
    }
    latinBuffer.push(ch);
    i++;
  }
  if (latinBuffer.length > 0) {
    flushLatin(latinBuffer, tokens);
  }
  return tokens;
}

function flushLatin(buf: string[], out: string[]): void {
  const word = buf.join("").trim();
  buf.length = 0;
  if (word.length === 0) return;
  out.push(word);
}

/**
 * BM25 スコア計算
 * BM25 score computation
 * Perhitungan skor BM25
 */
export interface BM25Doc {
  id: string;
  tokens: string[];
}

export interface BM25Index {
  docs: BM25Doc[];
  /** 語彙 -> [doc idx, tf][] */
  posting: Map<string, Array<[number, number]>>;
  /** 各 doc の長さ */
  docLens: number[];
  avgDocLen: number;
  n: number;
}

export function buildBm25Index(docs: BM25Doc[]): BM25Index {
  const posting = new Map<string, Array<[number, number]>>();
  const docLens: number[] = [];
  docs.forEach((doc, idx) => {
    const tf = new Map<string, number>();
    doc.tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    tf.forEach((count, term) => {
      const list = posting.get(term) ?? [];
      list.push([idx, count]);
      posting.set(term, list);
    });
    docLens.push(doc.tokens.length);
  });
  const avgDocLen = docLens.length === 0 ? 0 : docLens.reduce((a, b) => a + b, 0) / docLens.length;
  return { docs, posting, docLens, avgDocLen, n: docs.length };
}

/**
 * BM25 スコア計算 (k1=1.5, b=0.75)
 */
export function bm25Score(
  index: BM25Index,
  queryTokens: string[],
  opts: { k1?: number; b?: number } = {},
): Array<{ id: string; score: number }> {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;
  if (index.n === 0) return [];
  const scores = new Float64Array(index.n);
  const uniqueQuery = Array.from(new Set(queryTokens));
  for (const term of uniqueQuery) {
    const list = index.posting.get(term);
    if (!list) continue;
    const df = list.length;
    const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
    for (const [docIdx, tf] of list) {
      const dl = index.docLens[docIdx] ?? 1;
      const denom = tf + k1 * (1 - b + (b * dl) / (index.avgDocLen || 1));
      scores[docIdx] += (idf * (tf * (k1 + 1))) / (denom || 1);
    }
  }
  const results: Array<{ id: string; score: number }> = [];
  for (let i = 0; i < index.n; i++) {
    const s = scores[i]!;
    if (s > 0) {
      results.push({ id: index.docs[i]!.id, score: s });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}
