import rateLimit from "express-rate-limit";
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
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: (req) => {
    const authReq = req as AuthRequest;
    const plan = getPlanConfig(authReq.tenant?.subscription_plan);
    return plan.requests_per_minute;
  },
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    // テナントIDがあればテナント単位、なければIP単位
    return authReq.tenant?.id || req.ip || "unknown";
  },
  message: {
    jsonrpc: "2.0",
    error: {
      code: -32005,
      message: "Too many requests. Please try again later. Rate limit is based on your subscription plan."
    },
    id: null
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
