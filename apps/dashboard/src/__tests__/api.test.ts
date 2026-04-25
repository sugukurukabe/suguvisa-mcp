import { describe, it, expect, vi } from "vitest";
import {
  listPlans,
  getMe,
  createCheckout,
  createPortal,
  listApiKeys,
  issueApiKey,
  revokeApiKey,
  getUsage,
  ApiError,
} from "@/lib/api";

function mockFetch(response: { status?: number; body: unknown }): typeof fetch {
  return vi.fn(async () => {
    return {
      ok: (response.status ?? 200) < 400,
      status: response.status ?? 200,
      text: async () => JSON.stringify(response.body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("api client", () => {
  it("listPlans normalizes snake_case wire format into camelCase", async () => {
    const wire = {
      plans: [
        {
          key: "starter",
          name: "Starter",
          description: "Starter plan",
          monthly_price_jpy: 19800,
          yearly_price_jpy: 198000,
          features: { ocr: false, legal_search: true },
          limits: { requests_per_minute: 30, requests_per_day: 1000, max_bulk_records: 100 },
          stripe: { monthly_price_id: "price_m", yearly_price_id: "price_y" },
        },
      ],
    };
    const fetchImpl = mockFetch({ body: wire });
    const res = await listPlans({ apiUrl: "http://x", fetchImpl });
    expect(res[0]).toMatchObject({
      key: "starter",
      monthlyPriceJpy: 19800,
      yearlyPriceJpy: 198000,
      features: { legal_search: true },
      limits: { requestsPerMinute: 30, maxBulkRecords: 100 },
      stripePrices: { monthly: "price_m", yearly: "price_y" },
    });
  });

  it("getMe unwraps and camelCases the tenant snapshot", async () => {
    const wire = {
      status: "ok",
      tenant: {
        id: "t1",
        organization_name: "Acme",
        subscription_plan: "starter",
        plan_details: { requests_per_minute: 30, requests_per_day: 1000 },
        billing: {
          stripe_customer_id: "cus_1",
          subscription_status: "active",
          current_period_end: "2026-05-01T00:00:00Z",
          cancel_at_period_end: false,
        },
      },
    };
    const fetchImpl = mockFetch({ body: wire });
    const res = await getMe({ apiUrl: "http://x", accessToken: "tok", fetchImpl });
    expect(res.id).toBe("t1");
    expect(res.plan).toBe("starter");
    expect(res.organizationName).toBe("Acme");
    expect(res.planDetails?.requestsPerMinute).toBe(30);
    expect(res.billing?.stripeCustomerId).toBe("cus_1");
    expect(res.billing?.subscriptionStatus).toBe("active");
    expect(res.billing?.cancelAtPeriodEnd).toBe(false);
  });

  it("createCheckout posts price_id with bearer token and returns checkout_url as url", async () => {
    const spy = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("http://x/api/v1/billing/checkout");
      expect(init.method).toBe("POST");
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
      const body = JSON.parse(String(init.body));
      expect(body.price_id).toBe("price_m");
      expect(body.success_url).toBe("http://site/ok");
      expect(body.cancel_url).toBe("http://site/cancel");
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status: "ok", checkout_url: "https://checkout.stripe.com/session_xyz", session_id: "cs_test" }),
      } as unknown as Response;
    });
    // simulate NEXT_PUBLIC_SITE_URL via env proxy
    process.env.NEXT_PUBLIC_SITE_URL = "http://site";
    const res = await createCheckout(
      { priceId: "price_m", successPath: "/ok", cancelPath: "/cancel" },
      { apiUrl: "http://x", accessToken: "tok", fetchImpl: spy as unknown as typeof fetch },
    );
    expect(res.url).toContain("checkout.stripe.com");
    expect(res.sessionId).toBe("cs_test");
  });

  it("createPortal returns portal_url as url", async () => {
    const fetchImpl = mockFetch({ body: { status: "ok", portal_url: "https://billing.stripe.com/portal" } });
    const res = await createPortal({}, { apiUrl: "http://x", accessToken: "tok", fetchImpl });
    expect(res.url).toContain("billing.stripe.com");
  });

  it("listApiKeys camelCases the rows", async () => {
    const fetchImpl = mockFetch({
      body: {
        status: "ok",
        keys: [
          { id: "k1", label: "cd", status: "active", last_used_at: null, created_at: "2026-01-01" },
        ],
      },
    });
    const keys = await listApiKeys({ apiUrl: "http://x", accessToken: "tok", fetchImpl });
    expect(keys[0]).toMatchObject({ id: "k1", label: "cd", status: "active", lastUsedAt: null });
  });

  it("issueApiKey returns one-time token + key info", async () => {
    const fetchImpl = mockFetch({
      body: {
        status: "ok",
        key: "svmcp_xxxxxx",
        key_info: { id: "k1", label: "cd", status: "active", created_at: "2026-01-01" },
      },
    });
    const res = await issueApiKey({ label: "cd" }, { apiUrl: "http://x", accessToken: "tok", fetchImpl });
    expect(res.token).toMatch(/^svmcp_/);
    expect(res.keyInfo.id).toBe("k1");
  });

  it("revokeApiKey encodes id into url", async () => {
    const spy = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("http://x/api/v1/tenant/keys/abc%3D1");
      expect(init.method).toBe("DELETE");
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: "ok" }) } as unknown as Response;
    });
    await revokeApiKey("abc=1", { apiUrl: "http://x", accessToken: "tok", fetchImpl: spy as unknown as typeof fetch });
    expect(spy).toHaveBeenCalled();
  });

  it("getUsage parses shape", async () => {
    const fetchImpl = mockFetch({
      body: {
        status: "ok",
        plan: "starter",
        usage: {
          today: 12,
          today_limit: 1000,
          today_remaining: 988,
          this_month: 123,
          by_tool_today: { suguvisa_application_type_determine: { success: 10, error: 1 } },
        },
      },
    });
    const u = await getUsage({ apiUrl: "http://x", accessToken: "tok", fetchImpl });
    expect(u.today).toBe(12);
    expect(u.todayRemaining).toBe(988);
    expect(u.thisMonth).toBe(123);
    expect(u.byToolToday.suguvisa_application_type_determine.success).toBe(10);
  });

  it("throws ApiError with status and body on 4xx", async () => {
    const fetchImpl = mockFetch({ status: 403, body: { error: "forbidden" } });
    await expect(listPlans({ apiUrl: "http://x", fetchImpl })).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
    });
    try {
      await listPlans({ apiUrl: "http://x", fetchImpl });
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).body).toEqual({ error: "forbidden" });
    }
  });
});
