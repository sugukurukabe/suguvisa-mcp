import { describe, it, expect, vi } from "vitest";
import { verifyBilling } from "../verify.js";

function mockFetch(pages: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const matched = Object.keys(pages).find((k) => url.endsWith(k));
    if (!matched) {
      return { ok: false, status: 404, json: async () => null } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => pages[matched],
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("verifyBilling", () => {
  it("passes when health + plans are all configured", async () => {
    const fetchImpl = mockFetch({
      "/health": { billing: { status: "configured" } },
      "/api/v1/billing/plans": {
        plans: [
          {
            key: "starter",
            stripe: { monthly_price_id: "price_sm", yearly_price_id: "price_sy" },
          },
          {
            key: "professional",
            stripe: { monthly_price_id: "price_pm", yearly_price_id: "price_py" },
          },
          { key: "free", stripe: { monthly_price_id: null, yearly_price_id: null } },
        ],
      },
    });
    const out = await verifyBilling({ baseUrl: "http://x", fetchImpl, logger: () => {} });
    expect(out.ok).toBe(true);
  });

  it("fails when a paid plan is missing its monthly price id", async () => {
    const fetchImpl = mockFetch({
      "/health": { billing: { status: "configured" } },
      "/api/v1/billing/plans": {
        plans: [
          {
            key: "starter",
            stripe: { monthly_price_id: null, yearly_price_id: "price_sy" },
          },
        ],
      },
    });
    const out = await verifyBilling({ baseUrl: "http://x", fetchImpl, logger: () => {} });
    expect(out.ok).toBe(false);
    expect(out.checks.find((c) => c.name === "plan(starter).monthly_price_id")?.ok).toBe(false);
  });

  it("fails when /health reports billing as not configured", async () => {
    const fetchImpl = mockFetch({
      "/health": { billing: { status: "disabled" } },
      "/api/v1/billing/plans": { plans: [] },
    });
    const out = await verifyBilling({ baseUrl: "http://x", fetchImpl, logger: () => {} });
    expect(out.ok).toBe(false);
    expect(out.checks[0]?.name).toBe("health.billing.status");
    expect(out.checks[0]?.ok).toBe(false);
  });
});
