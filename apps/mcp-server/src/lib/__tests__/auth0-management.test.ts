/**
 * Auth0 Management API クライアントのユニットテスト
 * Unit tests for the Auth0 Management API client used by the DCR proxy.
 * Uji unit untuk klien Auth0 Management API yang digunakan proxy DCR.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createFirstPartyClient,
  isAuth0MgmtConfigured,
  loadAuth0MgmtConfig,
  _resetAuth0MgmtCache,
} from "../auth0-management.js";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    AUTH0_DOMAIN: "suguvisa-dev.jp.auth0.com",
    AUTH0_MGMT_CLIENT_ID: "mgmt_client_id",
    AUTH0_MGMT_CLIENT_SECRET: "mgmt_client_secret",
  };
  _resetAuth0MgmtCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("isAuth0MgmtConfigured / loadAuth0MgmtConfig", () => {
  it("必要な env が揃っていれば true", () => {
    expect(isAuth0MgmtConfigured()).toBe(true);
    expect(loadAuth0MgmtConfig()).toEqual({
      domain: "suguvisa-dev.jp.auth0.com",
      clientId: "mgmt_client_id",
      clientSecret: "mgmt_client_secret",
    });
  });

  it("AUTH0_MGMT_CLIENT_ID が無ければ false を返す", () => {
    delete process.env.AUTH0_MGMT_CLIENT_ID;
    expect(isAuth0MgmtConfigured()).toBe(false);
    expect(() => loadAuth0MgmtConfig()).toThrow(
      /Auth0 Management API credentials not configured/,
    );
  });
});

describe("createFirstPartyClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  it("Management API に必ず is_first_party:true を指定する", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "mgmt_token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            client_id: "abc123",
            name: "Test",
            callbacks: ["https://claude.ai/api/mcp/auth_callback"],
            grant_types: ["authorization_code", "refresh_token"],
            token_endpoint_auth_method: "none",
            is_first_party: true,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await createFirstPartyClient(loadAuth0MgmtConfig(), {
      name: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    });

    expect(result.clientId).toBe("abc123");
    expect(result.clientSecret).toBeUndefined();
    expect(result.grantTypes).toEqual(["authorization_code", "refresh_token"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toContain("/api/v2/clients");
    expect(secondCall[1]?.method).toBe("POST");
    const body = JSON.parse(secondCall[1]?.body as string);
    expect(body.is_first_party).toBe(true);
    expect(body.oidc_conformant).toBe(true);
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.callbacks).toEqual([
      "https://claude.ai/api/mcp/auth_callback",
    ]);
  });

  it("グローバル失敗時はエラーを投げる", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("bad", { status: 401 }),
    );
    await expect(
      createFirstPartyClient(loadAuth0MgmtConfig(), {
        name: "Claude",
        redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      }),
    ).rejects.toThrow(/Auth0 Management token fetch failed: 401/);
  });

  it("2 回目の呼び出しでは token 取得をキャッシュする", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/oauth/token")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ access_token: "mgmt_token", expires_in: 3600 }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ client_id: "id", name: "n" }),
          { status: 201 },
        ),
      );
    });

    await createFirstPartyClient(loadAuth0MgmtConfig(), {
      name: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
    });
    await createFirstPartyClient(loadAuth0MgmtConfig(), {
      name: "ChatGPT",
      redirectUris: ["https://chat.openai.com/aip/g/callback"],
    });

    const tokenCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/oauth/token"),
    );
    expect(tokenCalls.length).toBe(1);
  });
});
