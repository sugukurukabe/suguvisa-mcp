/**
 * Auth0 Management API クライアント (DCR Proxy 用)
 * Auth0 Management API client used by the DCR proxy to create first-party clients.
 * Klien Auth0 Management API untuk proxy DCR yang membuat client first-party.
 *
 * Auth0 の有料テナントで DCR (`/oidc/register`) を使うと、作成されるクライアントは
 * 強制的に `third_party_security_mode: "strict"` の Third-Party 扱いとなり、
 * 自社 API (custom audience) を要求できない。
 *
 * Auth0 paid tenants make every DCR-registered client a strict third-party client,
 * which cannot obtain access tokens for our custom API audience.
 * そこでこのモジュールから Management API 経由で `is_first_party: true` 指定で
 * クライアントを作成し、Claude / ChatGPT など MCP クライアントが正常に接続できるようにする。
 */

export interface Auth0MgmtConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
}

export interface CreateClientInput {
  name: string;
  redirectUris: string[];
  grantTypes?: string[];
  tokenEndpointAuthMethod?: "none" | "client_secret_post" | "client_secret_basic";
  clientUri?: string;
  logoUri?: string;
  contacts?: string[];
}

export interface CreatedClient {
  clientId: string;
  clientSecret?: string;
  name: string;
  callbacks: string[];
  grantTypes: string[];
  tokenEndpointAuthMethod: string;
  createdAt: number;
  clientSecretExpiresAt: number;
}

// 取得した Management API トークンをメモリキャッシュ。
// Cache the Management API access token in memory to avoid requesting one per call.
// Cache token Management API di memori agar tidak perlu meminta token tiap pemanggilan.
let cachedToken: { value: string; expiresAt: number } | null = null;

export function isAuth0MgmtConfigured(): boolean {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_MGMT_CLIENT_ID &&
      process.env.AUTH0_MGMT_CLIENT_SECRET,
  );
}

export function loadAuth0MgmtConfig(): Auth0MgmtConfig {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      "Auth0 Management API credentials not configured " +
        "(AUTH0_DOMAIN / AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET).",
    );
  }
  return { domain, clientId, clientSecret };
}

async function fetchMgmtToken(config: Auth0MgmtConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }

  const res = await fetch(`https://${config.domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: `https://${config.domain}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth0 Management token fetch failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return data.access_token;
}

interface Auth0ClientResponse {
  client_id: string;
  client_secret?: string;
  name: string;
  callbacks?: string[];
  grant_types?: string[];
  token_endpoint_auth_method?: string;
  is_first_party?: boolean;
  third_party_security_mode?: string;
}

export async function createFirstPartyClient(
  config: Auth0MgmtConfig,
  input: CreateClientInput,
): Promise<CreatedClient> {
  const token = await fetchMgmtToken(config);
  const grantTypes = input.grantTypes && input.grantTypes.length > 0
    ? input.grantTypes
    : ["authorization_code", "refresh_token"];
  const tokenAuthMethod = input.tokenEndpointAuthMethod ?? "none";

  // DCR クライアントは public な PKCE フローを使うことが多い。
  // app_type=regular_web + token_endpoint_auth_method=none で PKCE 必須にできる。
  const body = {
    name: input.name.slice(0, 128),
    app_type: "regular_web",
    is_first_party: true,
    oidc_conformant: true,
    token_endpoint_auth_method: tokenAuthMethod,
    grant_types: grantTypes,
    callbacks: input.redirectUris,
    client_uri: input.clientUri,
    logo_uri: input.logoUri,
    support_email: input.contacts?.[0],
  };

  const res = await fetch(`https://${config.domain}/api/v2/clients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Auth0 create client failed: ${res.status} ${errorBody}`);
  }

  const data = (await res.json()) as Auth0ClientResponse;
  const now = Math.floor(Date.now() / 1000);
  return {
    clientId: data.client_id,
    clientSecret:
      tokenAuthMethod === "none" ? undefined : data.client_secret,
    name: data.name,
    callbacks: data.callbacks ?? input.redirectUris,
    grantTypes: data.grant_types ?? grantTypes,
    tokenEndpointAuthMethod:
      data.token_endpoint_auth_method ?? tokenAuthMethod,
    createdAt: now,
    clientSecretExpiresAt: 0,
  };
}

// テスト/運用時にキャッシュをクリアするためのヘルパー。
// Helper to reset the cached token (used by tests and manual rotation).
// Pembantu untuk mereset token cache (dipakai oleh tes dan rotasi manual).
export function _resetAuth0MgmtCache(): void {
  cachedToken = null;
}
