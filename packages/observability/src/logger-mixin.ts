/**
 * pino mixin と observability コンテキストの橋渡し
 * Bridge between pino's `mixin` option and the observability context.
 * Jembatan antara opsi `mixin` pino dan konteks observability.
 *
 * 使い方 / Usage:
 *   import { createLogger } from "@suguvisa/core/logger";
 *   import { obsMixin } from "@suguvisa/observability";
 *   const log = createLogger({ pinoOptions: { mixin: obsMixin } });
 *
 * 以降、AsyncLocalStorage に格納された requestId / traceId / tenantId /
 * principalSubject / operation が全ログ行に自動付与される。
 */
import { getObsContext } from "./context.js";

/**
 * pino 向けの mixin: 現在の ObsContext をログフィールドに合流
 */
export function obsMixin(): Record<string, unknown> {
  const ctx = getObsContext();
  if (!ctx) return {};
  const out: Record<string, unknown> = {
    requestId: ctx.requestId,
  };
  if (ctx.traceId) out.traceId = ctx.traceId;
  if (ctx.spanId) out.spanId = ctx.spanId;
  if (ctx.tenantId) out.tenantId = ctx.tenantId;
  if (ctx.principalSubject) out.principal = ctx.principalSubject;
  if (ctx.operation) out.operation = ctx.operation;
  return out;
}
