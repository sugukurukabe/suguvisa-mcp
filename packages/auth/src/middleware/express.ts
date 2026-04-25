/**
 * Express 認証ミドルウェア
 * Express authentication middleware
 * Middleware autentikasi Express
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../verify-jwt.js';
import type { AuthProvider } from '../providers/index.js';
import type { Scope } from '../scopes.js';
import type { Principal } from '../types.js';
import { AuthError, buildWwwAuthenticate } from '../errors.js';

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export function createAuthMiddleware(
  provider: AuthProvider,
  opts?: {
    resourceMetadataUrl?: string;
    legacyApiKeyValidator?: (key: string) => Promise<Principal | null>;
  },
) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    const method = req.method;
    const path = req.path;
    if (!authHeader) {
      console.error(
        `[auth-mw] 401 missing_token method=${method} path=${path} ua="${(req.headers['user-agent'] ?? '').toString().slice(0, 60)}"`,
      );
      sendUnauthorized(res, new AuthError('missing_token', 'Missing Authorization header'), provider, opts?.resourceMetadataUrl);
      return;
    }

    const [scheme, token] = authHeader.split(' ', 2);
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      console.error(`[auth-mw] 401 invalid_scheme method=${method} path=${path} scheme=${scheme}`);
      sendUnauthorized(res, new AuthError('invalid_token', 'Invalid Authorization scheme'), provider, opts?.resourceMetadataUrl);
      return;
    }

    if (opts?.legacyApiKeyValidator) {
      const legacyPrincipal = await opts.legacyApiKeyValidator(token);
      if (legacyPrincipal) {
        req.principal = legacyPrincipal;
        next();
        return;
      }
    }

    const result = await verifyJwt(token, provider);
    if (result.isErr()) {
      // トークンの aud / iss / scope を最小限だけダンプしてデバッグしやすくする。
      // secret は出さない。header.kid / payload.aud / payload.iss / payload.scope のみ。
      let tokenInfo = 'parse_failed';
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          tokenInfo =
            `kid=${header.kid ?? '?'} alg=${header.alg ?? '?'} ` +
            `iss=${payload.iss ?? '?'} aud=${JSON.stringify(payload.aud ?? '?')} ` +
            `azp=${payload.azp ?? '?'} scope="${payload.scope ?? ''}" ` +
            `exp=${payload.exp ?? '?'} iat=${payload.iat ?? '?'}`;
        }
      } catch {
        // ignore decode failures
      }
      console.error(
        `[auth-mw] ${result.error.statusCode} ${result.error.code} method=${method} path=${path} ` +
          `message="${result.error.message}" token_info={${tokenInfo}}`,
      );
      sendUnauthorized(res, result.error, provider, opts?.resourceMetadataUrl);
      return;
    }

    req.principal = result.value;
    next();
  };
}

export function requireScope(...requiredScopes: Scope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const principal = req.principal;
    if (!principal) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const missing = requiredScopes.filter(s => !principal.scopes.includes(s));
    if (missing.length > 0) {
      const error = new AuthError(
        'insufficient_scope',
        `Missing required scopes: ${missing.join(', ')}`,
        403,
      );
      res.status(403).json({
        error: error.code,
        error_description: error.message,
      });
      return;
    }

    next();
  };
}

function sendUnauthorized(
  res: Response,
  error: AuthError,
  provider: AuthProvider,
  resourceMetadataUrl?: string,
): void {
  const wwwAuth = buildWwwAuthenticate({
    realm: provider.getAudience(),
    error: error.code,
    errorDescription: error.message,
    resourceMetadataUrl,
  });

  res.setHeader('WWW-Authenticate', wwwAuth);
  res.status(error.statusCode).json({
    error: error.code,
    error_description: error.message,
  });
}
