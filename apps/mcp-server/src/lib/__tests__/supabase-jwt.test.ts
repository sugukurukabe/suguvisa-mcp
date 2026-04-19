/**
 * Supabase JWT 検証ヘルパー / Supabase JWT verification helper / Helper verifikasi JWT Supabase
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../supabase.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { looksLikeJwt, verifySupabaseJwt, _resetSupabaseJwksCache } from "../supabase-jwt.js";
import { supabase } from "../supabase.js";

describe("looksLikeJwt", () => {
  it("3 つのドット区切りで 40 文字以上なら true", () => {
    const token = "aaaa.bbbb.cccc" + "x".repeat(40);
    expect(looksLikeJwt(token)).toBe(true);
  });

  it("短いもの・ドット数違いは false", () => {
    expect(looksLikeJwt("short")).toBe(false);
    expect(looksLikeJwt("svmcp_abc.123")).toBe(false);
    expect(looksLikeJwt("svmcp_e2e_test_d70567e9bced19da6b81acb9d81afee9")).toBe(false);
  });
});

describe("verifySupabaseJwt", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    _resetSupabaseJwksCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("SUPABASE_URL 未設定なら null", async () => {
    delete process.env.SUPABASE_URL;
    const result = await verifySupabaseJwt("header.payload.signature", "aud");
    expect(result).toBeNull();
  });

  it("壊れた JWT は null", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    const result = await verifySupabaseJwt("not-a-real-jwt", "aud");
    expect(result).toBeNull();
  });

  // 実 JWKS / 実 JWT による正常系は E2E テスト側で担保する。
  // ここでは副作用がないこと・既知の失敗系が null を返すことだけを検証する。
  it("tenants lookup は成功ケース以外 null", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    });
    const result = await verifySupabaseJwt("header.payload.signature", "aud");
    expect(result).toBeNull();
  });
});
