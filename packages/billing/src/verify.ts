/**
 * Stripe configuration verifier / Stripe 設定検証 / Verifikator konfigurasi Stripe
 *
 * デプロイ済みの MCP サーバーに対し、billing が正しく configure されているかを検証する。
 *
 *  - GET /health           — billing section が "configured" か
 *  - GET /api/v1/billing/plans — 全 public プランに stripe.*_price_id がセットされているか
 *  - (optional) Stripe secret key を渡すと Price の lookup_key 整合性も検証
 */
import { listPublicPlans } from "./plans.js";
import { buildSeedSpecs } from "./seed-plan.js";

export interface VerifyOptions {
  baseUrl: string;
  /** 任意: Stripe secret key を渡すと lookup_key の整合性もチェック */
  stripeSecretKey?: string;
  fetchImpl?: typeof fetch;
  logger?: (line: string) => void;
}

export interface VerifyResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

export async function verifyBilling(opts: VerifyOptions): Promise<VerifyResult> {
  const log = opts.logger ?? ((l) => console.log(l));
  const fetchFn = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, "");
  const checks: VerifyResult["checks"] = [];
  let ok = true;

  log(`▶ verifying ${base} ...`);

  // ─ /health ────────────────────────────────────────────────
  try {
    const res = await fetchFn(`${base}/health`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { billing?: { status?: string } } | null;
    const status = body?.billing?.status;
    const pass = res.ok && status === "configured";
    ok = ok && pass;
    checks.push({
      name: "health.billing.status",
      ok: pass,
      detail: pass ? "configured" : `expected "configured", got ${JSON.stringify(status)}`,
    });
  } catch (err) {
    ok = false;
    checks.push({ name: "health.billing.status", ok: false, detail: String(err) });
  }

  // ─ /api/v1/billing/plans ──────────────────────────────────
  interface WirePlan {
    key: string;
    stripe?: { monthly_price_id: string | null; yearly_price_id: string | null };
  }
  let wirePlans: WirePlan[] = [];
  try {
    const res = await fetchFn(`${base}/api/v1/billing/plans`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { plans?: WirePlan[] } | null;
    wirePlans = body?.plans ?? [];
    const pass = res.ok && wirePlans.length > 0;
    ok = ok && pass;
    checks.push({
      name: "billing/plans.reachable",
      ok: pass,
      detail: pass ? `${wirePlans.length} plans` : "no plans returned",
    });
  } catch (err) {
    ok = false;
    checks.push({ name: "billing/plans.reachable", ok: false, detail: String(err) });
  }

  // ─ price_id is set for every publicly-listed paid plan ───
  for (const plan of listPublicPlans()) {
    if (plan.monthlyPriceJpy === 0 && plan.yearlyPriceJpy === 0) continue;
    const wire = wirePlans.find((p) => p.key === plan.key);
    const monthlyOk = plan.monthlyPriceJpy === 0 || Boolean(wire?.stripe?.monthly_price_id);
    const yearlyOk = plan.yearlyPriceJpy === 0 || Boolean(wire?.stripe?.yearly_price_id);
    ok = ok && monthlyOk && yearlyOk;
    checks.push({
      name: `plan(${plan.key}).monthly_price_id`,
      ok: monthlyOk,
      detail: monthlyOk
        ? String(wire?.stripe?.monthly_price_id ?? "n/a")
        : "missing — set SUGUVISA_STRIPE_PRICE_" + plan.key.toUpperCase() + "_MONTHLY",
    });
    checks.push({
      name: `plan(${plan.key}).yearly_price_id`,
      ok: yearlyOk,
      detail: yearlyOk
        ? String(wire?.stripe?.yearly_price_id ?? "n/a")
        : "missing — set SUGUVISA_STRIPE_PRICE_" + plan.key.toUpperCase() + "_YEARLY",
    });
  }

  // ─ optional: Stripe SDK lookup_key check ─────────────────
  if (opts.stripeSecretKey) {
    try {
      const StripeMod = (await import("stripe")).default;
      const stripe = new StripeMod(opts.stripeSecretKey, {
        apiVersion: "2024-12-18.acacia" as unknown as string,
      } as unknown as ConstructorParameters<typeof StripeMod>[1]);
      const specs = buildSeedSpecs();
      for (const spec of specs.prices) {
        const list = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
        const price = list.data[0];
        const wire = wirePlans.find((p) => p.key === spec.planKey);
        const expected =
          spec.interval === "month" ? wire?.stripe?.monthly_price_id : wire?.stripe?.yearly_price_id;
        const match = Boolean(price && expected && price.id === expected);
        ok = ok && match;
        checks.push({
          name: `stripe.lookup(${spec.lookupKey})`,
          ok: match,
          detail: match
            ? `${price!.id} (${(price!.unit_amount ?? 0) / 1} JPY, ${spec.interval})`
            : `Stripe=${price?.id ?? "(none)"} vs server=${expected ?? "(none)"}`,
        });
      }
    } catch (err) {
      checks.push({ name: "stripe.sdk", ok: false, detail: String(err) });
      ok = false;
    }
  }

  for (const c of checks) {
    log(`  ${c.ok ? "✅" : "❌"} ${c.name.padEnd(40)} ${c.detail}`);
  }
  log(ok ? "\n🎉 all checks passed" : "\n⚠ one or more checks failed — see above");
  return { ok, checks };
}

// ─── CLI ────────────────────────────────────────────────────────────────
export async function runVerifyCli(argv: string[]): Promise<number> {
  const args = Object.fromEntries(
    argv.reduce<Array<[string, string | boolean]>>((acc, a, i, arr) => {
      if (!a.startsWith("--")) return acc;
      const next = arr[i + 1];
      acc.push([a, next && !next.startsWith("--") ? next : true]);
      return acc;
    }, []),
  );
  const baseUrl = (args["--url"] as string | undefined) ?? process.env.SUGUVISA_BASE_URL;
  const stripeKey = (args["--stripe-key"] as string | undefined) ?? process.env.STRIPE_SECRET_KEY;
  if (!baseUrl) {
    console.error("error: --url https://mcp.suguvisa.com (or SUGUVISA_BASE_URL) is required");
    return 1;
  }
  const result = await verifyBilling({ baseUrl, stripeSecretKey: stripeKey });
  return result.ok ? 0 : 1;
}
