/**
 * Supabase Auth JWT 検証ヘルパー (JWKS / ES256)
 * Supabase Auth JWT verification helper (JWKS / ES256)
 * Helper verifikasi JWT Supabase Auth (JWKS / ES256)
 *
 * Supabase の新プロジェクトは非対称鍵 (ES256) で JWT を署名する。
 * 公開鍵は {SUPABASE_URL}/auth/v1/.well-known/jwks.json から取得できるため、
 * MCP サーバーは秘密値なしで検証できる。
 *
 * New Supabase projects sign JWTs with asymmetric keys (ES256). The public key
 * is exposed at {SUPABASE_URL}/auth/v1/.well-known/jwks.json so the MCP server
 * can verify access tokens without storing a shared secret.
 *
 * Proyek Supabase baru menandatangani JWT dengan kunci asimetris (ES256).
 * Kunci publik tersedia di {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
 */
import {
  createRemoteJWKSet,
  jwtVerify,
  errors as joseErrors,
  type JWTPayload,
} from "jose";
import { supabase } from "./supabase.js";

export interface SupabasePrincipalLike {
  sub: string;
  tenantId: string;
  email?: string;
  iss: string;
  aud: string;
  exp: number;
  scopes: [];
}

export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3 && token.length > 40;
}

let jwksCache:
  | { jwks: ReturnType<typeof createRemoteJWKSet>; createdAt: number; uri: string }
  | null = null;
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

function getSupabaseJwks(uri: string): ReturnType<typeof createRemoteJWKSet> {
  const now = Date.now();
  if (jwksCache && jwksCache.uri === uri && now - jwksCache.createdAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.jwks;
  }
  const jwks = createRemoteJWKSet(new URL(uri));
  jwksCache = { jwks, createdAt: now, uri };
  return jwks;
}

/** @internal テスト用 */
export function _resetSupabaseJwksCache(): void {
  jwksCache = null;
}

/**
 * Supabase Auth が発行した access_token を検証する。
 * 成功時は sub → public.tenants.auth_user_id ルックアップで tenant を解決する。
 */
export async function verifySupabaseJwt(
  token: string,
  expectedAudience: string,
): Promise<SupabasePrincipalLike | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  const base = supabaseUrl.replace(/\/$/, "");
  const expectedIssuer = `${base}/auth/v1`;
  const jwksUri = `${base}/auth/v1/.well-known/jwks.json`;

  let payload: JWTPayload;
  try {
    const jwks = getSupabaseJwks(jwksUri);
    const result = await jwtVerify(token, jwks, {
      issuer: expectedIssuer,
      audience: "authenticated",
    });
    payload = result.payload;
  } catch (error: unknown) {
    if (
      error instanceof joseErrors.JWTExpired ||
      error instanceof joseErrors.JWTClaimValidationFailed ||
      error instanceof joseErrors.JWSSignatureVerificationFailed ||
      error instanceof joseErrors.JWSInvalid ||
      error instanceof joseErrors.JOSENotSupported
    ) {
      return null;
    }
    // JWKS fetch 失敗などその他のエラー
    return null;
  }

  const sub = (payload.sub as string | undefined) ?? "";
  if (!sub) return null;

  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, status")
      .eq("auth_user_id", sub)
      .eq("status", "active")
      .maybeSingle();

    if (!tenant) return null;

    return {
      sub,
      tenantId: (tenant as { id: string }).id,
      email: payload.email as string | undefined,
      iss: expectedIssuer,
      aud: expectedAudience,
      exp: (payload.exp as number | undefined) ?? Math.floor(Date.now() / 1000) + 3600,
      scopes: [],
    };
  } catch (error) {
    console.error("[supabase-jwt] tenant lookup failed:", error);
    return null;
  }
}
