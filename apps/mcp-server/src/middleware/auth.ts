import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";

/**
 * リクエストへの型拡張
 */
export interface AuthRequest extends Request {
  tenant?: {
    id: string;
    organization_name: string;
    /** チケットを考慮した実効プラン / Ticket-aware effective plan */
    subscription_plan: string;
    /** 生のサブスクリプションプラン (チケット判定に使う前の値) */
    raw_subscription_plan?: string;
    /** チケット (30日パス) の有効期限。未来なら Starter 相当付与中 */
    ticket_expires_at?: string | null;
  };
}

/**
 * API Key 認証ミドルウェア (SaaSマルチテナント対応)
 *
 * ヘッダー形式: Authorization: Bearer <API_KEY>
 */
export async function apiKeyAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // 環境変数によるローカルバイパス（開発時やローカル専用MCPとしての利用時）
  const localApiKey = process.env.SUGUVISA_API_KEY;

  // ヘルスチェック、プラグイン発見、MCP エンドポイントは認証不要
  // MCP はプロトコルレベルで認可を処理するため、HTTP 認証はバイパス
  const publicExact = new Set([
    "/",
    "/health",
    "/openapi.yaml",
    "/privacy",
    "/terms",
    "/security",
    "/support",
    "/docs",
    "/logo.svg",
    "/logo.png",
    "/app-icon-square.png",
    "/icon-1024.png",
    "/icon-512.png",
    "/icon-256.png",
    "/apple-touch-icon.png",
    "/favicon.svg",
    "/favicon.ico",
    "/favicon-32.png",
    "/og-image.svg",
    "/og-image.png",
    "/robots.txt",
    "/sitemap.xml",
    "/api/v1/billing/plans",
    "/api/v1/billing/webhook",
    "/oauth/register",
  ]);
  const publicPrefixes = ["/.well-known/", "/mcp", "/assets/"];
  // Google Search Console HTML-file verification path (e.g. /googleabc123.html)
  const isGoogleVerification = /^\/google[a-z0-9]+\.html$/i.test(req.path);
  if (
    publicExact.has(req.path) ||
    publicPrefixes.some((p) => req.path.startsWith(p)) ||
    isGoogleVerification
  ) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authorization header required" },
      id: null,
    });
    return;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") {
    res.status(401).json({
       jsonrpc: "2.0",
       error: { code: -32001, message: "Authorization scheme must be Bearer" },
       id: null,
    });
    return;
  }

  // 1. ローカル API Key によるバイパス認証 (単一ユーザー/開発環境向け)
  if (localApiKey && token === localApiKey) {
    req.tenant = {
      id: "local-dev-tenant",
      organization_name: "Local Environment",
      subscription_plan: "unlimited"
    };
    next();
    return;
  }



  // 2. SaaS モード: データベース(Supabase)からテナント情報を照合
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const { data: apiKeyData, error } = await supabase
        .from("api_keys")
        .select(`
          id,
          key,
          status,
          tenant_id,
          tenants (
            id,
            organization_name,
            subscription_plan,
            ticket_expires_at,
            status
          )
        `)
        .eq("key", token)
        .eq("status", "active")
        .single();
      
      if (error || !apiKeyData) {
        res.status(403).json({
          jsonrpc: "2.0",
          error: { code: -32002, message: "Invalid or inactive API key" },
          id: null,
        });
        return;
      }

      const tenant = Array.isArray(apiKeyData.tenants) ? apiKeyData.tenants[0] : apiKeyData.tenants;

      if (!tenant || tenant.status !== "active") {
        res.status(403).json({
          jsonrpc: "2.0",
          error: { code: -32002, message: "Tenant account is suspended or inactive" },
          id: null,
        });
        return;
      }

      // テナント情報をリクエストにアタッチ（チケット有効期限を考慮した実効プラン）
      // Attach tenant with ticket-aware effective plan
      req.tenant = {
        id: tenant.id,
        organization_name: tenant.organization_name,
        subscription_plan: resolveEffectivePlanForTenant(tenant),
        raw_subscription_plan: (tenant.subscription_plan ?? "free").toString(),
        ticket_expires_at: tenant.ticket_expires_at ?? null,
      };

      next();
      return;
    } catch (e) {
      console.error("[Auth] Database verification error:", e);
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32099, message: "Internal server error during authentication" },
        id: null,
      });
      return;
    }
  }

  // データベース未設定かつ localApiKey とも不一致の場合
  res.status(403).json({
    jsonrpc: "2.0",
    error: { code: -32002, message: "Invalid API key" },
    id: null,
  });
}

/**
 * チケット (30日パス) を考慮して実効プランを判定する共通ヘルパー。
 * Resolve effective plan considering ticket_expires_at (30-day pass).
 *
 * - サブスク (starter/professional/unlimited) はそのまま維持
 * - それ以外で ticket_expires_at が未来なら 'starter' として扱う
 */
function resolveEffectivePlanForTenant(tenant: {
  subscription_plan?: string | null;
  ticket_expires_at?: string | null;
}): string {
  const sub = (tenant.subscription_plan ?? "free").toString();
  if (sub === "starter" || sub === "professional" || sub === "unlimited") return sub;
  const expiry = tenant.ticket_expires_at ? new Date(tenant.ticket_expires_at).getTime() : 0;
  if (expiry > Date.now()) return "starter";
  return sub;
}
