/**
 * レート制限キーの生成関数
 * Key-generator functions for rate limiting
 * Fungsi generator kunci untuk pembatasan laju
 *
 * Cloud Run の X-Forwarded-For を正しく扱い、認証済みリクエストは
 * Principal (Auth0 sub / API key ID) を優先する設計。
 */
import type { Request } from "express";

/**
 * Request から実クライアント IP を抽出。
 * Extract the real client IP; honors trust proxy X-Forwarded-For.
 * Ekstrak IP klien sebenarnya; menghormati X-Forwarded-For.
 *
 * Express の `app.set('trust proxy', ...)` と連携する前提。
 */
export function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(xff) && xff[0]) {
    const first = xff[0].split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

/**
 * IP ベースのキー
 * IP-based key: "ip:<client-ip>".
 * Kunci berbasis IP: "ip:<ip-klien>".
 */
export function ipKey(req: Request): string {
  return `ip:${getClientIp(req)}`;
}

/**
 * Principal ベースのキー (auth ミドルウェア通過後に使用)
 * Principal-based key using req.principal populated by auth middleware.
 * Kunci berbasis Principal menggunakan req.principal dari middleware auth.
 *
 * `req.principal.sub` を第一候補、`clientId` を第二候補、IP をフォールバック。
 */
export function principalKey(req: Request): string {
  const principal = (req as Request & { principal?: { sub?: string; clientId?: string; tenantId?: string } }).principal;
  if (principal) {
    const parts: string[] = [];
    if (principal.tenantId) parts.push(`tenant:${principal.tenantId}`);
    if (principal.sub) parts.push(`sub:${principal.sub}`);
    else if (principal.clientId) parts.push(`client:${principal.clientId}`);
    if (parts.length > 0) return parts.join("|");
  }
  return ipKey(req);
}

/**
 * Tenant ベースのキー — マルチテナント quota 用
 * Tenant-scoped key for multi-tenant quotas.
 * Kunci tingkat tenant untuk kuota multi-tenant.
 */
export function tenantKey(req: Request): string {
  const principal = (req as Request & { principal?: { tenantId?: string } }).principal;
  if (principal?.tenantId) return `tenant:${principal.tenantId}`;
  return ipKey(req);
}
