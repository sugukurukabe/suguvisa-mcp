/**
 * @suguvisa/auth — OAuth 2.1 Resource Server
 *
 * SuguVisa の認証・認可パッケージ
 * Authentication & authorization package for SuguVisa
 * Paket autentikasi & otorisasi untuk SuguVisa
 */

export { SUGUVISA_SCOPES, ALL_SCOPES, type Scope } from './scopes.js';
export { AuthError, buildWwwAuthenticate, type AuthErrorCode } from './errors.js';
export { verifyJwt, _resetJwksCache } from './verify-jwt.js';
export { generateResourceMetadata, type ProtectedResourceMetadata } from './resource-metadata.js';
export { generateCodeVerifier, computeCodeChallenge, verifyCodeChallenge } from './pkce.js';
export { createAuthMiddleware, requireScope } from './middleware/express.js';
export { createAuthProvider, type AuthProvider } from './providers/index.js';
export type { Principal, AuthConfig } from './types.js';
