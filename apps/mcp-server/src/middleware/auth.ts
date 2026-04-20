import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";

/**
 * リクエストへの型拡張
 */
export interface AuthRequest extends Request {
  tenant?: {
    id: string;
    organization_name: string;
    subscription_plan: string;
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
    "/icon-1024.png",
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
  ]);
  const publicPrefixes = ["/.well-known/", "/mcp"];
  if (publicExact.has(req.path) || publicPrefixes.some(p => req.path.startsWith(p))) {
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

      // テナント情報をリクエストにアタッチ
      req.tenant = {
        id: tenant.id,
        organization_name: tenant.organization_name,
        subscription_plan: tenant.subscription_plan
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
