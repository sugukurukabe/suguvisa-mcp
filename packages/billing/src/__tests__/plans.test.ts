import { describe, expect, it } from "vitest";
import {
  buildPriceMappingFromEnv,
  getPlan,
  isPlanKey,
  listPublicPlans,
  PLAN_DEFINITIONS,
  resolvePlanFromPriceId,
} from "../plans.js";

describe("plan catalog", () => {
  it("returns free for unknown keys", () => {
    expect(getPlan(undefined).key).toBe("free");
    expect(getPlan("garbage").key).toBe("free");
  });

  it("identifies known plan keys", () => {
    expect(isPlanKey("free")).toBe(true);
    expect(isPlanKey("starter")).toBe(true);
    expect(isPlanKey("professional")).toBe(true);
    expect(isPlanKey("unlimited")).toBe(true);
    expect(isPlanKey("elite")).toBe(false);
  });

  it("lists only publicly listed plans", () => {
    const pub = listPublicPlans();
    expect(pub.map((p) => p.key)).toEqual(["free", "starter", "professional"]);
    expect(pub.every((p) => p.publiclyListed)).toBe(true);
  });

  it("free plan allows all tools (feature gates restrict OCR/bulk), paid plans do not specify", () => {
    // Free プランは全ツール試用可（OCR/一括生成などは features フラグで制御）
    // Free plan allows all tools; OCR/bulk/etc. are gated by `features` flags
    // Paket gratis mengizinkan semua alat; OCR/bulk dll dikontrol flag `features`
    expect(PLAN_DEFINITIONS.free.allowedTools).toBe("all");
    expect(PLAN_DEFINITIONS.starter.allowedTools).toBeUndefined();
    expect(PLAN_DEFINITIONS.professional.allowedTools).toBeUndefined();
  });
});

describe("price mapping", () => {
  it("reads env vars and builds mapping", () => {
    const env = {
      SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY: "price_starter_m",
      SUGUVISA_STRIPE_PRICE_STARTER_YEARLY: "price_starter_y",
      SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY: "price_pro_m",
    } as NodeJS.ProcessEnv;
    const mapping = buildPriceMappingFromEnv(env);
    expect(mapping).toHaveLength(3);
    expect(resolvePlanFromPriceId("price_pro_m", mapping)).toBe("professional");
    expect(resolvePlanFromPriceId("price_starter_y", mapping)).toBe("starter");
    expect(resolvePlanFromPriceId("price_unknown", mapping)).toBeNull();
  });

  it("ignores blank or missing env", () => {
    const env = {
      SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY: "",
      SUGUVISA_STRIPE_PRICE_STARTER_YEARLY: "   ",
    } as NodeJS.ProcessEnv;
    expect(buildPriceMappingFromEnv(env)).toHaveLength(0);
  });
});
