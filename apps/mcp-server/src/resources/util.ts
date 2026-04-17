/**
 * MCP Resource ユーティリティ
 * MCP resource helper utilities
 * Utilitas pembantu resource MCP
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * data/ 配下の JSON を読み込む
 * Load a JSON file from the `data/` directory
 * Memuat file JSON dari direktori `data/`
 */
export function loadJson<T = unknown>(filename: string): T {
  const candidates = [
    path.resolve(__dirname, "..", "data", filename),
    path.resolve(__dirname, "data", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
    }
  }
  throw new Error(`Data file not found: ${filename} (searched ${candidates.join(", ")})`);
}

/**
 * JSON レスポンスを MCP Resource 形式でラップ
 * Wrap a JSON payload into the MCP resource response shape
 * Bungkus payload JSON ke dalam bentuk respons resource MCP
 */
export function jsonResource(uri: string, payload: unknown): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Markdown レスポンスを MCP Resource 形式でラップ
 */
export function markdownResource(uri: string, text: string): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text,
      },
    ],
  };
}
