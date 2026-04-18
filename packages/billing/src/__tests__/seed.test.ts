import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import { seedStripe } from "../seed.js";

function makeStripeMock(opts: {
  existingProductPlans?: string[];
  existingPriceLookups?: string[];
}): { stripe: Stripe; created: { products: string[]; prices: string[] } } {
  const created = { products: [] as string[], prices: [] as string[] };
  const stripe = {
    products: {
      search: vi.fn(async ({ query }: { query: string }) => {
        const match = query.match(/metadata\['suguvisa_plan'\]:'([^']+)'/);
        const plan = match?.[1];
        if (plan && opts.existingProductPlans?.includes(plan)) {
          return { data: [{ id: `prod_existing_${plan}` }] };
        }
        return { data: [] };
      }),
      create: vi.fn(async (input: { metadata: { suguvisa_plan: string } }) => {
        const plan = input.metadata.suguvisa_plan;
        created.products.push(plan);
        return { id: `prod_new_${plan}` };
      }),
    },
    prices: {
      list: vi.fn(async ({ lookup_keys }: { lookup_keys: string[] }) => {
        const lk = lookup_keys[0];
        if (lk && opts.existingPriceLookups?.includes(lk)) {
          return { data: [{ id: `price_existing_${lk}` }] };
        }
        return { data: [] };
      }),
      create: vi.fn(async (input: { lookup_key: string }) => {
        created.prices.push(input.lookup_key);
        return { id: `price_new_${input.lookup_key}` };
      }),
    },
  } as unknown as Stripe;
  return { stripe, created };
}

describe("seedStripe", () => {
  it("creates all products and prices on a fresh account", async () => {
    const { stripe, created } = makeStripeMock({});
    const result = await seedStripe({ stripe, logger: () => {} });

    expect(result.products.every((p) => p.created)).toBe(true);
    expect(result.prices.every((p) => p.created)).toBe(true);
    expect(created.products.sort()).toEqual(["professional", "starter"]);
    expect(created.prices.sort()).toEqual([
      "suguvisa_professional_monthly",
      "suguvisa_professional_yearly",
      "suguvisa_starter_monthly",
      "suguvisa_starter_yearly",
    ]);
  });

  it("reuses existing Product and Prices when lookup matches (idempotent)", async () => {
    const { stripe, created } = makeStripeMock({
      existingProductPlans: ["starter"],
      existingPriceLookups: ["suguvisa_starter_monthly", "suguvisa_starter_yearly"],
    });
    const result = await seedStripe({ stripe, logger: () => {} });

    const starterProduct = result.products.find((p) => p.planKey === "starter");
    expect(starterProduct?.created).toBe(false);
    expect(starterProduct?.productId).toBe("prod_existing_starter");

    const starterMonthly = result.prices.find(
      (p) => p.planKey === "starter" && p.interval === "month",
    );
    expect(starterMonthly?.created).toBe(false);
    expect(starterMonthly?.priceId).toBe("price_existing_suguvisa_starter_monthly");

    // Professional が新規作成される
    expect(created.products).toContain("professional");
    expect(created.prices).toContain("suguvisa_professional_monthly");
    // starter は再作成されない
    expect(created.products).not.toContain("starter");
    expect(created.prices).not.toContain("suguvisa_starter_monthly");
  });

  it("dry-run does not create, but still returns deterministic placeholder ids", async () => {
    const { stripe, created } = makeStripeMock({});
    const result = await seedStripe({ stripe, dryRun: true, logger: () => {} });
    expect(created.products).toEqual([]);
    expect(created.prices).toEqual([]);
    expect(result.prices.every((p) => p.priceId.startsWith("price_DRYRUN_"))).toBe(true);
  });
});
