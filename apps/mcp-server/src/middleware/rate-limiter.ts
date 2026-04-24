import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { AuthRequest } from "./auth.js";
import { getPlanConfig } from "../lib/plans.js";

// ==========================================
// テナント別レートリミット (SaaSプラン対応)
// ==========================================

/**
 * テナントのサブスクリプションプランに応じた動的レートリミット。
 * - free: 10 req/min
 * - starter: 30 req/min
 * - professional: 60 req/min
 * - unlimited: 300 req/min
 *
 * Claude Desktop / ChatGPT は短時間に複数並列コールを送るため、
 * `MCP_DISCOVERY_BURST_BYPASS` をセットすると initialize / tools/list /
 * resources/list / prompts/list のみレート制限をバイパスする。
 */
const DISCOVERY_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "tools/list",
  "resources/list",
  "prompts/list",
  "resources/templates/list",
]);

export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: (req) => {
    const authReq = req as AuthRequest;
    const plan = getPlanConfig(authReq.tenant?.subscription_plan);
    return plan.requests_per_minute;
  },
  keyGenerator: (req, _res) => {
    const authReq = req as AuthRequest;
    // テナントIDがあればテナント単位、なければIP単位（IPv6対応のヘルパー経由）
    // Tenant id if available, else IP (via IPv6-safe helper)
    // ID tenant jika tersedia, jika tidak IP (via helper aman IPv6)
    return authReq.tenant?.id || ipKeyGenerator(req.ip ?? "unknown", 56);
  },
  skip: (req) => {
    // MCP プロトコルの discovery 系メソッドはクライアントが接続毎に必ず呼ぶため除外
    // Skip discovery methods to avoid false rate-limit triggers on connect
    // Lewati metode discovery agar tidak memicu rate limit palsu saat koneksi
    const method =
      typeof req.body === "object" && req.body !== null && typeof (req.body as { method?: unknown }).method === "string"
        ? ((req.body as { method: string }).method)
        : undefined;
    return method !== undefined && DISCOVERY_METHODS.has(method);
  },
  handler: (req, res, _next, options) => {
    // JSON-RPC 2.0 互換エラー + Retry-After ヘッダ
    // JSON-RPC 2.0 compatible error + Retry-After header
    // Error kompatibel JSON-RPC 2.0 + header Retry-After
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(options.statusCode).json({
      jsonrpc: "2.0",
      error: {
        code: -32005,
        message: `レート制限に達しました。${retryAfterSec} 秒後に再試行してください / Rate limited. Retry after ${retryAfterSec}s / Batas permintaan tercapai. Coba lagi dalam ${retryAfterSec}d.`,
        data: { retryAfterSec, plan: (req as AuthRequest).tenant?.subscription_plan ?? "unknown" },
      },
      id:
        typeof req.body === "object" && req.body !== null && "id" in req.body
          ? (req.body as { id: unknown }).id
          : null,
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ツール単位のアクセス制御ミドルウェア（server.ts での使用はオプション）
 * MCP endpointでは tools/call の params.name をチェックして使用
 */
export function checkToolAccess(toolName: string, planName?: string): { allowed: boolean; reason?: string } {
  const plan = getPlanConfig(planName);
  if (plan.allowed_tools === "all") {
    return { allowed: true };
  }
  if (plan.allowed_tools.includes(toolName)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `ツール '${toolName}' は ${plan.name} プランでは利用できません。プランのアップグレードをご検討ください。`,
  };
}
