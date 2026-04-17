import { createHash } from "node:crypto";

/**
 * content + summary から SHA-256 checksum を計算
 * Compute SHA-256 checksum from content + summary
 * Menghitung checksum SHA-256 dari content + summary
 */
export function computeChecksum(content: string, summary: string): string {
  return createHash("sha256").update(`${summary}\n---\n${content}`, "utf8").digest("hex");
}
