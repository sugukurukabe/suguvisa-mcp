/**
 * Dataset loader — JSONL ファイルから EvalCase を読み込む
 * Dataset loader
 * Pemuat dataset
 */
import * as fs from "fs";
import * as path from "path";
import type { EvalCase } from "./types.js";

/**
 * JSONL (1 行 = 1 ケース) を読み込み、EvalCase[] を返す
 * Read a JSONL file and return an array of eval cases
 */
export function loadDatasetSync<TInput = unknown, TExpected = unknown>(
  filePath: string,
): Array<EvalCase<TInput, TExpected>> {
  const resolved = path.resolve(filePath);
  const text = fs.readFileSync(resolved, "utf-8");
  return parseJsonl<TInput, TExpected>(text, resolved);
}

/**
 * JSONL 文字列をパースする。
 * Parses JSONL content. Lines starting with `#` or empty lines are ignored.
 */
export function parseJsonl<TInput = unknown, TExpected = unknown>(
  content: string,
  source = "<inline>",
): Array<EvalCase<TInput, TExpected>> {
  const out: Array<EvalCase<TInput, TExpected>> = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      const obj = JSON.parse(line) as EvalCase<TInput, TExpected>;
      if (!obj.id || obj.input === undefined) {
        throw new Error(`missing id or input`);
      }
      out.push(obj);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${source}:${i + 1}: invalid JSONL line: ${message}`);
    }
  }
  return out;
}

/**
 * EvalCase[] を JSONL 文字列に変換
 */
export function serializeJsonl<TInput, TExpected>(
  cases: Array<EvalCase<TInput, TExpected>>,
): string {
  return cases.map((c) => JSON.stringify(c)).join("\n") + "\n";
}
