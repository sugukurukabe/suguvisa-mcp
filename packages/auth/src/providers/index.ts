/**
 * 認証プロバイダーインターフェース
 * Authentication provider interface
 * Antarmuka penyedia autentikasi
 */

import type { AuthConfig } from '../types.js';

export interface AuthProvider {
  getJwksUri(): string;
  getIssuer(): string;
  getAudience(): string;
  getAuthorizationServerMetadata(): Promise<Record<string, unknown>>;
}

export function createAuthProvider(config: AuthConfig): AuthProvider {
  return new Auth0Provider(config);
}

class Auth0Provider implements AuthProvider {
  constructor(private readonly config: AuthConfig) {}

  getJwksUri(): string {
    return `https://${this.config.domain}/.well-known/jwks.json`;
  }

  getIssuer(): string {
    return this.config.issuerBaseUrl.endsWith('/')
      ? this.config.issuerBaseUrl
      : `${this.config.issuerBaseUrl}/`;
  }

  getAudience(): string {
    return this.config.audience;
  }

  async getAuthorizationServerMetadata(): Promise<Record<string, unknown>> {
    const url = `https://${this.config.domain}/.well-known/openid-configuration`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch AS metadata from ${url}: ${res.status}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }
}
