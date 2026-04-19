/**
 * Supabase Auth JWT 検証ヘルパー
 * Supabase Auth JWT verification helper
 * Helper verifikasi JWT Supabase Auth
 *
 * Supabase のデフォルト JWT は HS256 + 共有シークレットで署名される。
 * ダッシュボード (@supabase/ssr) のセッションから取得した access_token を
 * MCP サーバー側で検証し、sub クレームからテナントを解決する用途。
 *
 * The default Supabase JWT is signed with HS256 + a shared secret.
 * We verify the access_token issued to the dashboard (via @supabase/ssr)
 * on the MCP side and resolve the tenant from the `sub` claim.
 */
import { jwtVerify, errors as joseErrors, type JWTPayload } from "jose";
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

/**
 * JWT 形式の簡易判定 (header.payload.signature) / Quick JWT format check / Cek format JWT
 */
export function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3 && token.length > 40;
}

/**
 * Supabase Auth が発行した access_token を検証する。
 * 成功時は sub → public.tenants.auth_user_id ルックアップで tenant を解決する。
 *
 * Verify a Supabase-issued access_token and resolve the tenant by looking up
 * `public.tenants.auth_user_id = sub`.
 *
 * @returns Principal-like object, or null when verification/lookup fails.
 */
export async function verifySupabaseJwt(
  token: string,
  expectedAudience: string,
): Promise<SupabasePrincipalLike | null> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!jwtSecret || !supabaseUrl) return null;

  // Supabase の iss は `${SUPABASE_URL}/auth/v1` 形式。
  const expectedIssuer = `${supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  const secretKey = new TextEncoder().encode(jwtSecret);

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, secretKey, {
      issuer: expectedIssuer,
      // Supabase はデフォルトで aud = "authenticated" を使う
      audience: "authenticated",
    });
    payload = result.payload;
  } catch (error: unknown) {
    if (
      error instanceof joseErrors.JWTExpired ||
      error instanceof joseErrors.JWTClaimValidationFailed ||
      error instanceof joseErrors.JWSSignatureVerificationFailed ||
      error instanceof joseErrors.JWSInvalid
    ) {
      return null;
    }
    // 他のエラー（ネットワーク等）は呼び出し側に委ねるため null で握りつぶす。
    return null;
  }

  const sub = (payload.sub as string | undefined) ?? "";
  if (!sub) return null;

  // sub (auth.users.id) → tenants.auth_user_id で lookup
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
