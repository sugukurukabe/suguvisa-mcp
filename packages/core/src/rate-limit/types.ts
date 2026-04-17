/**
 * レート制限の型定義
 * Rate limit type definitions
 * Definisi tipe pembatasan laju
 */
import type { Request } from "express";

/**
 * レート制限の識別子を生成する関数
 * Function that produces the rate-limit key for a request.
 * Fungsi yang menghasilkan kunci pembatasan laju untuk permintaan.
 */
export type KeyGenerator = (req: Request) => string;

/**
 * プラン別の既定 quota — 将来 Stripe と連動させる土台
 * Default per-plan quotas — foundation to be wired to Stripe later.
 * Kuota default per paket — fondasi untuk dihubungkan ke Stripe nanti.
 */
export interface PlanQuota {
  /** 1時間あたりのツール呼び出し上限 / Tool calls per hour */
  readonly toolCallsPerHour: number;
  /** 1分あたりのリクエスト上限 / Requests per minute */
  readonly requestsPerMinute: number;
}

/**
 * レート制限レイヤー定義
 * Rate limit layer definition
 * Definisi lapisan pembatasan laju
 */
export interface RateLimitLayerConfig {
  /** 窓の長さ (ms) / Window in milliseconds */
  readonly windowMs: number;
  /** 窓あたりの上限 / Max hits per window */
  readonly max: number;
  /** 429 時のメッセージ / Message returned on 429 */
  readonly message?: string;
  /** キー生成ロジック / Key generator override */
  readonly keyGenerator?: KeyGenerator;
  /** true なら成功レスポンスをカウントしない / Skip successful responses */
  readonly skipSuccessful?: boolean;
  /** true なら失敗レスポンスをカウントしない / Skip failed responses */
  readonly skipFailed?: boolean;
}
