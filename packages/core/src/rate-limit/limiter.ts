/**
 * レート制限ミドルウェアのファクトリー
 * Rate limit middleware factories built on top of express-rate-limit
 * Factory middleware pembatasan laju di atas express-rate-limit
 *
 * 使い方 / Usage / Penggunaan:
 *   import { createRateLimiter, rateLimitPresets } from "@suguvisa/core";
 *
 *   app.use(createRateLimiter(rateLimitPresets.global));
 *   app.use("/.well-known", createRateLimiter(rateLimitPresets.sensitive));
 *   app.use("/mcp", createRateLimiter(rateLimitPresets.mcp));
 *
 * Redis を使う場合 / Use Redis in production / Untuk produksi gunakan Redis:
 *   const store = await createRedisStore(process.env.REDIS_URL);
 *   app.use(createRateLimiter({ ...rateLimitPresets.global, store }));
 */
import rateLimit, {
  type Options as ExpressRateLimitOptions,
  type Store,
} from "express-rate-limit";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ipKey, principalKey, tenantKey } from "./keys.js";
import type { PlanQuota, RateLimitLayerConfig } from "./types.js";

/**
 * 規定のレート制限プリセット
 * Built-in rate limit presets
 * Preset bawaan pembatasan laju
 */
export const rateLimitPresets = {
  /**
   * グローバル: IP あたり 100 req/min
   * Global: 100 req/min per IP. Applied first, rejects obvious floods.
   */
  global: {
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: ipKey,
    message: "Too many requests from this IP",
  } satisfies RateLimitLayerConfig,

  /**
   * 機密系: IP あたり 10 req/min
   * Sensitive: 10 req/min per IP — for /.well-known, /oauth/* (brute-force).
   */
  sensitive: {
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: ipKey,
    message: "Too many requests to a sensitive endpoint",
  } satisfies RateLimitLayerConfig,

  /**
   * MCP: Principal あたり 60 req/min
   * MCP: 60 req/min per authenticated principal (sub / client_id).
   */
  mcp: {
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: principalKey,
    message: "Too many MCP calls; slow down",
  } satisfies RateLimitLayerConfig,

  /**
   * ツール呼び出し: テナント あたり 1000 req/hour
   * Tool calls: 1000/hour per tenant — base quota for "starter" plan.
   */
  toolCallsPerTenant: {
    windowMs: 60 * 60 * 1000,
    max: 1000,
    keyGenerator: tenantKey,
    message: "Tenant quota exceeded",
  } satisfies RateLimitLayerConfig,
} as const;

/**
 * プラン別のデフォルト quota
 * Default per-plan quotas — wire up to Stripe in Phase 4.
 * Kuota default per paket — akan terhubung ke Stripe di Phase 4.
 */
export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  free: { toolCallsPerHour: 50, requestsPerMinute: 30 },
  starter: { toolCallsPerHour: 1000, requestsPerMinute: 60 },
  pro: { toolCallsPerHour: 5000, requestsPerMinute: 120 },
  enterprise: { toolCallsPerHour: 100000, requestsPerMinute: 600 },
};

/**
 * 追加オプション
 * Additional options for the factory
 * Opsi tambahan untuk factory
 */
export interface CreateRateLimiterOptions extends RateLimitLayerConfig {
  /** Redis / メモリ等のストア / Backing store (memory by default) */
  readonly store?: Store;
  /** 429 時のカスタムハンドラ / Custom 429 handler */
  readonly handler?: (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * createRateLimiter — Express ミドルウェアを返す
 * Build an Express rate-limiter middleware.
 * Membangun middleware pembatas laju Express.
 */
export function createRateLimiter(
  options: CreateRateLimiterOptions,
): RequestHandler {
  const handler =
    options.handler ??
    ((req: Request, res: Response): void => {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      res
        .status(429)
        .setHeader("Retry-After", String(retryAfterSeconds))
        .json({
          error: "rate_limit_exceeded",
          error_description:
            options.message ?? "Too many requests. Please slow down.",
          retry_after_seconds: retryAfterSeconds,
        });
    });

  const limitOptions: Partial<ExpressRateLimitOptions> = {
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: options.keyGenerator ?? ipKey,
    handler,
    skipSuccessfulRequests: options.skipSuccessful ?? false,
    skipFailedRequests: options.skipFailed ?? false,
  };

  if (options.store) {
    limitOptions.store = options.store;
  }

  return rateLimit(limitOptions);
}

/**
 * 2 つ以上のミドルウェアを一つにまとめるヘルパー
 * Helper to chain multiple rate-limit middlewares (all must pass).
 * Helper untuk merangkai beberapa middleware (semua harus lolos).
 */
export function chainRateLimiters(
  ...limiters: RequestHandler[]
): RequestHandler {
  return (req, res, next) => {
    let index = 0;
    const run = (err?: unknown): void => {
      if (err) return next(err);
      if (index >= limiters.length) return next();
      const current = limiters[index++];
      current(req, res, run);
    };
    run();
  };
}
