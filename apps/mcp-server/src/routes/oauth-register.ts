/**
 * RFC 7591 Dynamic Client Registration プロキシ
 * RFC 7591 Dynamic Client Registration proxy.
 * Proxy RFC 7591 Dynamic Client Registration.
 *
 * Auth0 のネイティブ DCR (`/oidc/register`) は有料テナントで必ず
 * strict な Third-Party クライアントを作り、自社 API を要求できない。
 * Auth0's built-in DCR always produces strict third-party clients on paid
 * tenants, which cannot access custom APIs.
 * このプロキシは受け取った DCR リクエストを Management API に流し直し、
 * `is_first_party: true` を付けて first-party クライアントとして登録する。
 */

import type { Request, Response } from "express";
import {
  createFirstPartyClient,
  findFirstPartyClient,
  isAuth0MgmtConfigured,
  loadAuth0MgmtConfig,
  type CreateClientInput,
} from "../lib/auth0-management.js";

interface DcrRequestBody {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  token_endpoint_auth_method?: unknown;
  client_uri?: unknown;
  logo_uri?: unknown;
  contacts?: unknown;
}

const ALLOWED_AUTH_METHODS = new Set([
  "none",
  "client_secret_post",
  "client_secret_basic",
]);

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) return null;
    out.push(item);
  }
  return out;
}

function sendJsonError(
  res: Response,
  status: number,
  error: string,
  description: string,
): void {
  res.status(status).json({ error, error_description: description });
}

/**
 * DCR リクエスト (RFC 7591) を受けて Auth0 に first-party クライアントを作成して返す。
 * Accepts an RFC 7591 Dynamic Client Registration request and provisions a
 * first-party client in Auth0 via Management API.
 */
export async function oauthRegisterHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!isAuth0MgmtConfigured()) {
    sendJsonError(
      res,
      503,
      "server_error",
      "Dynamic Client Registration is not configured on this server.",
    );
    return;
  }

  const body = (req.body ?? {}) as DcrRequestBody;

  const redirectUris = asStringArray(body.redirect_uris);
  if (!redirectUris || redirectUris.length === 0) {
    sendJsonError(
      res,
      400,
      "invalid_redirect_uri",
      "redirect_uris must be a non-empty array of strings.",
    );
    return;
  }

  for (const uri of redirectUris) {
    if (!/^https?:\/\//i.test(uri)) {
      sendJsonError(
        res,
        400,
        "invalid_redirect_uri",
        `Redirect URI must use http(s): ${uri}`,
      );
      return;
    }
  }

  const grantTypes = asStringArray(body.grant_types);
  if (body.grant_types !== undefined && !grantTypes) {
    sendJsonError(
      res,
      400,
      "invalid_client_metadata",
      "grant_types must be an array of strings when present.",
    );
    return;
  }

  let authMethod: "none" | "client_secret_post" | "client_secret_basic" = "none";
  if (typeof body.token_endpoint_auth_method === "string") {
    if (!ALLOWED_AUTH_METHODS.has(body.token_endpoint_auth_method)) {
      sendJsonError(
        res,
        400,
        "invalid_client_metadata",
        `Unsupported token_endpoint_auth_method: ${body.token_endpoint_auth_method}`,
      );
      return;
    }
    authMethod = body.token_endpoint_auth_method as typeof authMethod;
  }

  const clientName = typeof body.client_name === "string" && body.client_name.length > 0
    ? body.client_name
    : "Unnamed MCP Client";

  const contacts = asStringArray(body.contacts) ?? undefined;

  const input: CreateClientInput = {
    name: `${clientName} (via SuguVisa DCR Proxy)`,
    redirectUris,
    grantTypes: grantTypes ?? undefined,
    tokenEndpointAuthMethod: authMethod,
    clientUri: typeof body.client_uri === "string" ? body.client_uri : undefined,
    logoUri: typeof body.logo_uri === "string" ? body.logo_uri : undefined,
    contacts,
  };

  try {
    const config = loadAuth0MgmtConfig();

    // 冪等性: 同名 + 同じ redirect_uris の既存 first-party client があれば再利用する。
    // Idempotency: reuse an existing first-party client with the same name and
    // redirect URIs if one already exists, to avoid hitting the Auth0 tenant
    // client limit on repeated reconnections.
    // Idempotensi: gunakan kembali klien first-party yang ada dengan nama dan
    // redirect URI yang sama untuk menghindari batas client tenant Auth0.
    const existing = await findFirstPartyClient(config, {
      name: input.name,
      redirectUris: input.redirectUris,
    });

    const client = existing ?? (await createFirstPartyClient(config, input));

    // RFC 7591 は成功時のステータスを 201 Created のみと規定している。
    // 冪等に既存クライアントを再利用した場合でも 201 を返さないと、
    // 厳格に検証するクライアント (oauth4webapi / Smithery scanner) は
    // "response is not a conform Dynamic Client Registration Endpoint response
    //  (unexpected HTTP status code)" で失敗する。
    //
    // RFC 7591 mandates HTTP 201 Created for successful registrations. Even
    // when we idempotently reuse an existing client, we must still return 201;
    // returning 200 breaks strict validators such as oauth4webapi used by the
    // Smithery scanner and Claude Desktop.
    //
    // RFC 7591 mewajibkan HTTP 201 Created untuk pendaftaran yang berhasil.
    // Meski kita menggunakan kembali klien yang ada secara idempoten, kita tetap
    // harus mengembalikan 201; mengembalikan 200 merusak validator ketat seperti
    // oauth4webapi yang digunakan oleh Smithery scanner dan Claude Desktop.
    const response: Record<string, unknown> = {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.callbacks,
      grant_types: client.grantTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      client_id_issued_at: client.createdAt,
      client_secret_expires_at: client.clientSecretExpiresAt,
      response_types: ["code"],
    };
    if (client.clientSecret) {
      response.client_secret = client.clientSecret;
    }

    res.status(201).json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[oauth-register] failed to provision client:", message);
    sendJsonError(
      res,
      502,
      "server_error",
      "Failed to create dynamic client. Please retry or contact support.",
    );
  }
}
