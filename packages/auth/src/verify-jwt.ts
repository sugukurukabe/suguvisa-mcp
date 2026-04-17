/**
 * JWT 検証（jose ライブラリ + JWKS キャッシュ）
 * JWT verification (jose library + JWKS cache)
 * Verifikasi JWT (library jose + cache JWKS)
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload, errors as joseErrors } from 'jose';
import { ok, err, type Result } from 'neverthrow';
import { AuthError } from './errors.js';
import type { Principal } from './types.js';
import type { Scope } from './scopes.js';
import type { AuthProvider } from './providers/index.js';

const JWKS_CACHE_TTL = 10 * 60 * 1000;

let jwksCache: { jwks: ReturnType<typeof createRemoteJWKSet>; createdAt: number } | null = null;

function getJwks(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.createdAt < JWKS_CACHE_TTL) {
    return jwksCache.jwks;
  }

  const jwks = createRemoteJWKSet(new URL(jwksUri));
  jwksCache = { jwks, createdAt: now };
  return jwks;
}

/** @internal テスト用にキャッシュをリセットする / Reset cache for testing */
export function _resetJwksCache(): void {
  jwksCache = null;
}

export async function verifyJwt(
  token: string,
  provider: AuthProvider,
): Promise<Result<Principal, AuthError>> {
  try {
    const jwks = getJwks(provider.getJwksUri());
    const expectedIssuer = provider.getIssuer();
    const expectedAudience = provider.getAudience();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: expectedIssuer,
      audience: expectedAudience,
    });

    return ok(payloadToPrincipal(payload, expectedIssuer, expectedAudience));
  } catch (error: unknown) {
    if (error instanceof joseErrors.JWTExpired) {
      return err(new AuthError('expired_token', 'Token has expired'));
    }
    if (error instanceof joseErrors.JWTClaimValidationFailed) {
      const claim = error.claim;
      if (claim === 'iss') {
        return err(new AuthError('invalid_issuer', `Invalid issuer: ${error.message}`));
      }
      if (claim === 'aud') {
        return err(new AuthError('invalid_audience', `Invalid audience: ${error.message}`));
      }
      return err(new AuthError('invalid_token', error.message));
    }
    if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
      return err(new AuthError('invalid_token', `Invalid token signature: ${error.message}`));
    }
    if (error instanceof Error) {
      return err(new AuthError('invalid_token', error.message));
    }
    return err(new AuthError('invalid_token', 'Unknown token verification error'));
  }
}

function payloadToPrincipal(
  payload: JWTPayload,
  iss: string,
  aud: string,
): Principal {
  const scopeStr = (payload['scope'] as string) ?? '';
  const scopes = scopeStr.split(' ').filter(Boolean) as Scope[];

  const tenantId =
    (payload['https://suguvisa.jp/tenant_id'] as string) ??
    (payload['tenant_id'] as string) ??
    (payload['sub'] as string) ??
    '';

  return {
    sub: (payload['sub'] as string) ?? '',
    tenantId,
    scopes,
    email: payload['email'] as string | undefined,
    iss,
    aud,
    exp: payload['exp'] ?? 0,
  };
}
