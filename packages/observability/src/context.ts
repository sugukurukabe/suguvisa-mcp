import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { ObsContext } from "./types.js";

const storage = new AsyncLocalStorage<ObsContext>();

/**
 * 現在のリクエストコンテキストを取得
 * Get the current request context
 * Dapatkan konteks permintaan saat ini
 */
export function getObsContext(): ObsContext | undefined {
  return storage.getStore();
}

/**
 * コンテキストを紐付けて非同期処理を実行
 * Run an async function with the given observability context
 * Jalankan fungsi async dengan konteks observability yang diberikan
 */
export function withObsContext<T>(ctx: ObsContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn);
}

/**
 * コンテキストを部分更新 (同一スコープ内で追記)
 * Partially update the current context (mutating; visible to children)
 * Perbarui sebagian konteks saat ini (mengubah; terlihat oleh anak)
 */
export function updateObsContext(patch: Partial<ObsContext>): void {
  const cur = storage.getStore();
  if (!cur) return;
  const { attrs: patchAttrs, ...rest } = patch;
  Object.assign(cur, rest);
  if (patchAttrs) {
    cur.attrs = { ...(cur.attrs ?? {}), ...patchAttrs };
  }
}

/**
 * 新しい request id を生成
 * Generate a fresh request id
 * Buat request id baru
 */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * W3C traceparent ヘッダをパース
 * Parse a W3C traceparent header
 * Parsing header traceparent W3C
 *
 * Format: "version-traceid-spanid-flags" (all hex)
 */
export function parseTraceparent(
  header: string | undefined,
): { traceId: string; spanId: string } | undefined {
  if (!header) return undefined;
  const parts = header.trim().split("-");
  if (parts.length !== 4) return undefined;
  const [version, traceId, spanId] = parts;
  if (version !== "00") return undefined;
  if (!traceId || traceId.length !== 32) return undefined;
  if (!spanId || spanId.length !== 16) return undefined;
  if (/[^0-9a-f]/i.test(traceId) || /[^0-9a-f]/i.test(spanId)) return undefined;
  return { traceId, spanId };
}
