import { describe, it, expect } from "vitest";
import { buildSeedSpecs, envVarForPlan, formatEnvExport } from "../seed-plan.js";

describe("seed-plan", () => {
  it("plans products only for publicly-listed paid plans", () => {
    const { products } = buildSeedSpecs();
    const keys = products.map((p) => p.planKey);
    expect(keys).toContain("starter");
    expect(keys).toContain("professional");
    expect(keys).not.toContain("free");
    expect(keys).not.toContain("unlimited");
  });

  it("plans 2 prices per paid plan (monthly + yearly) with correct env var names", () => {
    const { prices } = buildSeedSpecs();
    const starter = prices.filter((p) => p.planKey === "starter");
    expect(starter).toHaveLength(2);
    const monthly = starter.find((p) => p.interval === "month");
    const yearly = starter.find((p) => p.interval === "year");
    expect(monthly?.amountJpy).toBe(19800);
    expect(monthly?.lookupKey).toBe("suguvisa_starter_monthly");
    expect(monthly?.envVarName).toBe("SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY");
    expect(yearly?.amountJpy).toBe(198000);
    expect(yearly?.envVarName).toBe("SUGUVISA_STRIPE_PRICE_STARTER_YEARLY");
  });

  it("envVarForPlan builds upper-snake-cased names", () => {
    expect(envVarForPlan("starter", "month")).toBe("SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY");
    expect(envVarForPlan("professional", "year")).toBe("SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY");
  });

  it("formatEnvExport returns copy-pasteable KEY=VALUE lines", () => {
    const out = formatEnvExport([
      { envVarName: "A", priceId: "price_1" },
      { envVarName: "B", priceId: "price_2" },
    ]);
    expect(out).toBe("A=price_1\nB=price_2");
  });
});
