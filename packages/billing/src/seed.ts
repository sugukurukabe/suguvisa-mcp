/**
 * Stripe seeding runner / Stripe シード実行器 / Runner seeder Stripe
 *
 * Stripe に対し冪等に Products と Prices を作成する (既存は lookup_key で再利用)。
 *
 * 使い方 / Usage:
 *   tsx packages/billing/src/seed.ts --key sk_test_... --mode test [--dry-run]
 *   pnpm --filter @suguvisa/billing seed -- --mode test
 */
import Stripe from "stripe";
import { PLAN_DEFINITIONS, type PlanKey } from "./plans.js";
import {
  buildSeedSpecs,
  formatEnvExport,
  type SeedPriceSpec,
  type SeedProductSpec,
} from "./seed-plan.js";

export interface SeedOptions {
  stripe: Stripe;
  /** "test" or "live" — logging only; Stripe knows from the secret key */
  mode?: "test" | "live";
  dryRun?: boolean;
  logger?: (line: string) => void;
}

export interface SeedResult {
  products: Array<{ planKey: PlanKey; productId: string; created: boolean }>;
  prices: Array<{
    planKey: PlanKey;
    interval: "month" | "year";
    priceId: string;
    envVarName: string;
    created: boolean;
  }>;
}

export async function seedStripe(opts: SeedOptions): Promise<SeedResult> {
  const log = opts.logger ?? ((l) => console.log(l));
  const specs = buildSeedSpecs();
  const result: SeedResult = { products: [], prices: [] };

  log(`\n▶ SuguVisa Stripe seed (${opts.mode ?? "test"}${opts.dryRun ? ", dry-run" : ""})`);
  log(`  ${specs.products.length} products / ${specs.prices.length} prices planned\n`);

  const productsByPlan = new Map<PlanKey, string>();

  for (const spec of specs.products) {
    const { productId, created } = await upsertProduct(opts.stripe, spec, opts.dryRun ?? false);
    productsByPlan.set(spec.planKey, productId);
    result.products.push({ planKey: spec.planKey, productId, created });
    log(
      `  ${created ? "＋" : "＝"} product ${spec.name.padEnd(28)} → ${productId}` +
        (created ? "  (created)" : "  (reused)"),
    );
  }

  log("");

  for (const spec of specs.prices) {
    const productId = productsByPlan.get(spec.planKey);
    if (!productId) throw new Error(`missing product for plan ${spec.planKey}`);
    const { priceId, created } = await upsertPrice(opts.stripe, spec, productId, opts.dryRun ?? false);
    result.prices.push({
      planKey: spec.planKey,
      interval: spec.interval,
      priceId,
      envVarName: spec.envVarName,
      created,
    });
    log(
      `  ${created ? "＋" : "＝"} price  ${spec.nickname.padEnd(28)} → ${priceId}` +
        (created ? "  (created)" : "  (reused)"),
    );
  }

  log("\n─── Env vars to set on the MCP server ───");
  log(
    formatEnvExport(
      result.prices.map((p) => ({ envVarName: p.envVarName, priceId: p.priceId })),
    ),
  );
  log("");

  return result;
}

async function upsertProduct(
  stripe: Stripe,
  spec: SeedProductSpec,
  dryRun: boolean,
): Promise<{ productId: string; created: boolean }> {
  // dry-run: Stripe には一切触らず、新規作成扱いで placeholder id を返す
  if (dryRun) {
    return { productId: `prod_DRYRUN_${spec.planKey}`, created: true };
  }
  // 既存の product を `metadata.suguvisa_plan = <planKey>` で検索する。
  // Stripe には product に対する list-by-metadata がないので search API を使う。
  const found = await stripe.products.search({
    query: `active:'true' AND metadata['suguvisa_plan']:'${spec.metadataPlanKey}'`,
    limit: 1,
  });
  if (found.data[0]) {
    return { productId: found.data[0].id, created: false };
  }
  const created = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { suguvisa_plan: spec.metadataPlanKey },
  });
  return { productId: created.id, created: true };
}

async function upsertPrice(
  stripe: Stripe,
  spec: SeedPriceSpec,
  productId: string,
  dryRun: boolean,
): Promise<{ priceId: string; created: boolean }> {
  if (dryRun) {
    return { priceId: `price_DRYRUN_${spec.planKey}_${spec.interval}`, created: true };
  }
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    return { priceId: existing.data[0].id, created: false };
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: "jpy",
    unit_amount: spec.amountJpy,
    recurring: { interval: spec.interval },
    nickname: spec.nickname,
    lookup_key: spec.lookupKey,
    metadata: { suguvisa_plan: spec.planKey, suguvisa_interval: spec.interval },
  });
  return { priceId: created.id, created: true };
}

// ─── CLI ────────────────────────────────────────────────────────────────
export async function runCli(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const dryRun = Boolean(args["--dry-run"]);
  const keyArg = args["--key"];
  const key = (typeof keyArg === "string" ? keyArg : undefined) ?? process.env.STRIPE_SECRET_KEY;
  if (!key && !dryRun) {
    console.error("error: --key or STRIPE_SECRET_KEY required (unless --dry-run)");
    return 1;
  }
  const mode: "test" | "live" = key?.startsWith("sk_live_") ? "live" : "test";
  if (mode === "live" && !args["--allow-live"]) {
    console.error(
      "error: live secret key detected but --allow-live not passed. Refusing to run.\n" +
        "Use --allow-live to confirm you want to mutate production Stripe.",
    );
    return 2;
  }

  // dry-run で key を渡さなかった場合は ダミー key で SDK を構築 (実際には呼ばれない)
  const stripe = new Stripe(key ?? "sk_test_DRYRUN_NOOP", {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  });

  try {
    const result = await seedStripe({ stripe, mode, dryRun });
    const missing = (Object.keys(PLAN_DEFINITIONS) as PlanKey[]).filter(
      (k) => PLAN_DEFINITIONS[k].publiclyListed && PLAN_DEFINITIONS[k].monthlyPriceJpy > 0,
    );
    const ok = missing.every((k) => result.prices.some((p) => p.planKey === k));
    if (!ok) {
      console.error("warn: some plans did not get priced. Review the output above.");
      return 3;
    }
    return 0;
  } catch (err) {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    return 4;
  }
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg || !arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[arg] = next;
      i += 1;
    } else {
      out[arg] = true;
    }
  }
  return out;
}
