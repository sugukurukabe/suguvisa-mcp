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
    const created = await createFirstPartyClient(config, input);

    // RFC 7591 に沿った最小セットを返す。
    // Return the minimum RFC 7591-compliant registration response.
    // Kembalikan respons pendaftaran minimum sesuai RFC 7591.
    const response: Record<string, unknown> = {
      client_id: created.clientId,
      client_name: created.name,
      redirect_uris: created.callbacks,
      grant_types: created.grantTypes,
      token_endpoint_auth_method: created.tokenEndpointAuthMethod,
      client_id_issued_at: created.createdAt,
      client_secret_expires_at: created.clientSecretExpiresAt,
      response_types: ["code"],
    };
    if (created.clientSecret) {
      response.client_secret = created.clientSecret;
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
