import type { SearchHit } from "./types.js";

/**
 * LLM プロンプトに差し込む Context ブロックを生成
 * Build a context block for LLM prompt injection
 * Membangun blok konteks untuk injeksi prompt LLM
 */
export function formatHitsForPrompt(hits: SearchHit[]): string {
  if (hits.length === 0) return "(該当する Golden Records は見つかりませんでした)";
  return hits
    .map((hit, idx) => {
      const r = hit.record;
      const valid = `${r.validFrom} – ${r.validUntil ?? "現行"}`;
      const sourceUrl = r.source.url ? ` (${r.source.url})` : "";
      return [
        `[${idx + 1}] **${r.title}**  id=${r.id}  version=${r.version}`,
        `    Source: ${r.source.name}${sourceUrl}`,
        `    Valid: ${valid}`,
        `    Summary: ${r.summary}`,
        "",
        indent(r.content, "    "),
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
