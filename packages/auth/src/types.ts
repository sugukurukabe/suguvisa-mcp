/**
 * 認証プリンシパル（認証済みユーザー情報）
 * Authentication principal (authenticated user info)
 * Prinsipal autentikasi (info pengguna terautentikasi)
 */

import type { Scope } from './scopes.js';

export interface Principal {
  sub: string;
  tenantId: string;
  scopes: Scope[];
  email?: string;
  iss: string;
  aud: string;
  exp: number;
}

export interface AuthConfig {
  domain: string;
  audience: string;
  issuerBaseUrl: string;
  mgmtClientId?: string;
  mgmtClientSecret?: string;
  allowLegacyApiKey?: boolean;
}
