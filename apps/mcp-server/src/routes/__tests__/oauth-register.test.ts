/**
 * RFC 7591 DCR プロキシのユニットテスト
 * Unit tests for the DCR proxy handler (RFC 7591).
 * Uji unit untuk handler proxy DCR (RFC 7591).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../lib/auth0-management.js", () => ({
  isAuth0MgmtConfigured: vi.fn(),
  loadAuth0MgmtConfig: vi.fn(() => ({
    domain: "suguvisa-dev.jp.auth0.com",
    clientId: "mgmt",
    clientSecret: "secret",
  })),
  createFirstPartyClient: vi.fn(),
}));

import { oauthRegisterHandler } from "../oauth-register.js";
import {
  isAuth0MgmtConfigured,
  createFirstPartyClient,
} from "../../lib/auth0-management.js";

function mockResponse(): Response & {
  _status?: number;
  _json?: unknown;
} {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as Response;
  }) as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res._json = body;
    return res as Response;
  }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}

describe("oauthRegisterHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Management API 未設定時は 503 を返す", async () => {
    vi.mocked(isAuth0MgmtConfigured).mockReturnValue(false);
    const res = mockResponse();
    await oauthRegisterHandler(
      {
        body: {
          redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        },
      } as Request,
      res,
    );
    expect(res._status).toBe(503);
    expect(res._json).toMatchObject({ error: "server_error" });
  });

  it("redirect_uris が無ければ 400 を返す", async () => {
    vi.mocked(isAuth0MgmtConfigured).mockReturnValue(true);
    const res = mockResponse();
    await oauthRegisterHandler({ body: {} } as Request, res);
    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({ error: "invalid_redirect_uri" });
  });

  it("http(s) 以外の redirect_uri を弾く", async () => {
    vi.mocked(isAuth0MgmtConfigured).mockReturnValue(true);
    const res = mockResponse();
    await oauthRegisterHandler(
      {
        body: {
          redirect_uris: ["mailto:foo@example.com"],
        },
      } as Request,
      res,
    );
    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({ error: "invalid_redirect_uri" });
  });

  it("正常系は 201 で RFC 7591 形式を返し、client_secret は auth_method=none なら含めない", async () => {
    vi.mocked(isAuth0MgmtConfigured).mockReturnValue(true);
    vi.mocked(createFirstPartyClient).mockResolvedValue({
      clientId: "new_client",
      clientSecret: undefined,
      name: "Claude (via SuguVisa DCR Proxy)",
      callbacks: ["https://claude.ai/api/mcp/auth_callback"],
      grantTypes: ["authorization_code", "refresh_token"],
      tokenEndpointAuthMethod: "none",
      createdAt: 1234567890,
      clientSecretExpiresAt: 0,
    });

    const res = mockResponse();
    await oauthRegisterHandler(
      {
        body: {
          client_name: "Claude",
          redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
          grant_types: ["authorization_code", "refresh_token"],
          token_endpoint_auth_method: "none",
        },
      } as Request,
      res,
    );

    expect(res._status).toBe(201);
    expect(res._json).toMatchObject({
      client_id: "new_client",
      client_id_issued_at: 1234567890,
      client_secret_expires_at: 0,
      token_endpoint_auth_method: "none",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
    expect(res._json).not.toHaveProperty("client_secret");

    const args = vi.mocked(createFirstPartyClient).mock.calls[0][1];
    expect(args.name).toContain("Claude");
    expect(args.name).toContain("SuguVisa DCR Proxy");
  });

  it("Management API 失敗時は 502 を返す", async () => {
    vi.mocked(isAuth0MgmtConfigured).mockReturnValue(true);
    vi.mocked(createFirstPartyClient).mockRejectedValue(
      new Error("Auth0 create client failed: 500"),
    );
    const res = mockResponse();
    await oauthRegisterHandler(
      {
        body: {
          client_name: "Claude",
          redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        },
      } as Request,
      res,
    );
    expect(res._status).toBe(502);
    expect(res._json).toMatchObject({ error: "server_error" });
  });
});
