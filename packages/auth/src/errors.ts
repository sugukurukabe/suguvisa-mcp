/**
 * 認証エラー型
 * Authentication error types
 * Tipe error autentikasi
 */

export type AuthErrorCode =
  | 'invalid_token'
  | 'expired_token'
  | 'insufficient_scope'
  | 'invalid_audience'
  | 'invalid_issuer'
  | 'missing_token'
  | 'jwks_error'
  | 'legacy_key_invalid';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * WWW-Authenticate ヘッダーを構築する
 * Build WWW-Authenticate header value
 * Membangun nilai header WWW-Authenticate
 */
export function buildWwwAuthenticate(params: {
  realm: string;
  error?: AuthErrorCode;
  errorDescription?: string;
  resourceMetadataUrl?: string;
  scope?: string;
}): string {
  const parts = [`Bearer realm="${params.realm}"`];

  if (params.error) {
    parts.push(`error="${params.error}"`);
  }
  if (params.errorDescription) {
    parts.push(`error_description="${params.errorDescription}"`);
  }
  if (params.resourceMetadataUrl) {
    parts.push(`resource_metadata="${params.resourceMetadataUrl}"`);
  }
  if (params.scope) {
    parts.push(`scope="${params.scope}"`);
  }

  return parts.join(', ');
}
