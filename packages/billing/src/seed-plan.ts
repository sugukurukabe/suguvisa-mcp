/**
 * Stripe Product + Price の「計画 (plan)」を純粋関数で組み立てる。
 * Build Stripe Product/Price seed plans as a pure function.
 * Bangun rencana seed Stripe Product/Price sebagai fungsi murni.
 *
 * ここでは Stripe SDK を呼ばない。seed.ts が actual I/O を担当する。
 * No Stripe SDK calls here. seed.ts is responsible for actual I/O.
 */
import { PLAN_DEFINITIONS, type PlanDefinition, type PlanKey } from "./plans.js";

export interface SeedProductSpec {
  planKey: PlanKey;
  /** Stripe Product.name (日本語) */
  name: string;
  /** Stripe Product.description */
  description: string;
  /** 期待される `metadata.suguvisa_plan` 値。lookup に使用 */
  metadataPlanKey: string;
}

export interface SeedPriceSpec {
  planKey: PlanKey;
  interval: "month" | "year";
  /** JPY の最小単位 = 円そのもの (Stripe は zero-decimal currency として扱う) */
  amountJpy: number;
  /** Stripe Price の lookup_key。冪等な再走に使う */
  lookupKey: string;
  /** 対応する env 変数名。出力用 */
  envVarName: string;
  nickname: string;
}

/**
 * プラン定義から Stripe 側に作るべき Product/Price のスペックを返す。
 * Returns the Product/Price specs to create in Stripe from the plan catalog.
 */
export function buildSeedSpecs(plans: Record<PlanKey, PlanDefinition> = PLAN_DEFINITIONS): {
  products: SeedProductSpec[];
  prices: SeedPriceSpec[];
} {
  const products: SeedProductSpec[] = [];
  const prices: SeedPriceSpec[] = [];

  for (const p of Object.values(plans)) {
    // free と unlimited は Stripe に登録しない (無料 / 契約ベース)
    if (p.monthlyPriceJpy === 0 && p.yearlyPriceJpy === 0) continue;

    products.push({
      planKey: p.key,
      name: `SuguVisa ${p.name}`,
      description: p.description.ja,
      metadataPlanKey: p.key,
    });

    if (p.monthlyPriceJpy > 0) {
      prices.push({
        planKey: p.key,
        interval: "month",
        amountJpy: p.monthlyPriceJpy,
        lookupKey: `suguvisa_${p.key}_monthly`,
        envVarName: envVarForPlan(p.key, "month"),
        nickname: `${p.name} (月額)`,
      });
    }
    if (p.yearlyPriceJpy > 0) {
      prices.push({
        planKey: p.key,
        interval: "year",
        amountJpy: p.yearlyPriceJpy,
        lookupKey: `suguvisa_${p.key}_yearly`,
        envVarName: envVarForPlan(p.key, "year"),
        nickname: `${p.name} (年額)`,
      });
    }
  }

  return { products, prices };
}

export function envVarForPlan(planKey: PlanKey, interval: "month" | "year"): string {
  const suffix = interval === "month" ? "MONTHLY" : "YEARLY";
  return `SUGUVISA_STRIPE_PRICE_${planKey.toUpperCase()}_${suffix}`;
}

/**
 * Format an env export snippet so the caller can paste it into `.env` or
 * `gcloud run services update ... --update-env-vars`.
 */
export function formatEnvExport(pairs: Array<{ envVarName: string; priceId: string }>): string {
  return pairs.map((p) => `${p.envVarName}=${p.priceId}`).join("\n");
}
