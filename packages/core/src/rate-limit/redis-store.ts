/**
 * Redis ベースのストア生成
 * Redis-backed store factory (optional)
 * Factory store berbasis Redis (opsional)
 *
 * @suguvisa/core はデフォルトで in-memory store を使う。Cloud Run 等の
 * マルチインスタンス本番環境では `REDIS_URL` を設定し、本関数で生成した
 * store を `createRateLimiter({ ..., store })` に渡す。
 *
 * 依存は optional peer として扱い、本番のみインストールする想定:
 *   pnpm add ioredis rate-limit-redis --filter @suguvisa/mcp-server-app
 *
 * NOTE: "ioredis" / "rate-limit-redis" は本パッケージの dependencies に
 * 追加しない（アプリ側で管理）。import は遅延評価で行う。
 */
import type { Store } from "express-rate-limit";

export interface RedisStoreOptions {
  /** Redis 接続 URL (redis://... or rediss://...) */
  readonly url: string;
  /** キーのプレフィックス (既定: "suguvisa-rl:") */
  readonly prefix?: string;
}

/**
 * createRedisStore — 本番用 Redis store
 * Create a Redis-backed rate-limit store for production deployments.
 * Membuat store Redis untuk deployment produksi.
 *
 * @throws ioredis / rate-limit-redis が install されていない場合
 */
export async function createRedisStore(
  options: RedisStoreOptions,
): Promise<Store> {
  // optional peer を静的解析から隠蔽する dynamic import ヘルパー
  // Hide optional peers from TypeScript static analysis via runtime eval.
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier);",
  ) as (specifier: string) => Promise<unknown>;

  let RedisMod: unknown;
  let RedisStoreMod: unknown;
  try {
    RedisMod = await dynamicImport("ioredis");
    RedisStoreMod = await dynamicImport("rate-limit-redis");
  } catch (err) {
    throw new Error(
      "createRedisStore requires `ioredis` and `rate-limit-redis` to be installed. " +
        'Install with `pnpm add ioredis rate-limit-redis --filter @suguvisa/mcp-server-app`. ' +
        `Inner error: ${(err as Error).message}`,
    );
  }

  const RedisCtor =
    (RedisMod as { default?: unknown }).default ??
    (RedisMod as { Redis?: unknown }).Redis ??
    RedisMod;
  const RedisStoreCtor =
    (RedisStoreMod as { default?: unknown }).default ?? RedisStoreMod;

  type RedisClient = {
    call(command: string, ...args: unknown[]): Promise<unknown>;
  };

  const client = new (RedisCtor as new (url: string) => RedisClient)(options.url);
  const store = new (RedisStoreCtor as new (init: {
    sendCommand: (...args: unknown[]) => Promise<unknown>;
    prefix?: string;
  }) => Store)({
    sendCommand: (...args: unknown[]) =>
      client.call(args[0] as string, ...args.slice(1)),
    prefix: options.prefix ?? "suguvisa-rl:",
  });
  return store;
}
