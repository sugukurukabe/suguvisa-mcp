/**
 * Billing API ルーター (Phase 3 Task 3.1)
 *
 * エンドポイント:
 *   GET  /api/v1/billing/plans            — 公開プラン一覧 (未認証可)
 *   POST /api/v1/billing/checkout         — Stripe Checkout Session 作成 (認証要)
 *   POST /api/v1/billing/portal           — Customer Portal Session 作成 (認証要)
 *   POST /api/v1/billing/webhook          — Stripe Webhook (RAW body)
 */
import { Router, type Request } from "express";
import express from "express";
import type { AuthRequest } from "../middleware/auth.js";
import {
  listPublicPlans,
  processStripeEvent,
  resolvePlanFromPriceId,
  type BillingIntent,
} from "@suguvisa/billing";
import {
  getBillingClient,
  getBillingRepository,
  getPriceMappings,
  isBillingConfigured,
} from "../lib/billing.js";

export const billingRouter = Router();

// ─── GET /api/v1/billing/plans ───────────────────────────────────────────────
// Public: currently exposed plans with their features / limits / Stripe prices.
billingRouter.get("/plans", (_req, res) => {
  const mappings = getPriceMappings();
  const plans = listPublicPlans().map((p) => {
    const monthly = mappings.find((m) => m.plan === p.key && m.interval === "month");
    const yearly = mappings.find((m) => m.plan === p.key && m.interval === "year");
    return {
      key: p.key,
      name: p.name,
      description: p.description,
      monthly_price_jpy: p.monthlyPriceJpy,
      yearly_price_jpy: p.yearlyPriceJpy,
      features: p.features,
      limits: {
        requests_per_minute: p.requestsPerMinute,
        requests_per_day: p.requestsPerDay,
        max_bulk_records: p.maxBulkRecords,
      },
      stripe: {
        monthly_price_id: monthly?.priceId ?? null,
        yearly_price_id: yearly?.priceId ?? null,
      },
    };
  });
  res.json({ status: "ok", plans });
});

// ─── POST /api/v1/billing/checkout ───────────────────────────────────────────
// Body: { price_id: string, interval?: "month" | "year", success_url, cancel_url }
billingRouter.post("/checkout", async (req: AuthRequest, res) => {
  const tenant = req.tenant;
  if (!tenant || tenant.id === "local-dev-tenant") {
    res.status(403).json({ status: "error", message: "Authenticated SaaS tenant required" });
    return;
  }
  const { price_id, success_url, cancel_url, customer_email, trial_period_days } = req.body ?? {};
  if (!price_id || !success_url || !cancel_url) {
    res.status(400).json({
      status: "error",
      message: "price_id, success_url, cancel_url are required",
    });
    return;
  }
  const mappings = getPriceMappings();
  const resolvedPlan = resolvePlanFromPriceId(price_id, mappings);
  if (!resolvedPlan) {
    res.status(400).json({
      status: "error",
      message: `price_id ${price_id} is not a known SuguVisa plan. See /api/v1/billing/plans.`,
    });
    return;
  }

  try {
    const client = getBillingClient();
    const repo = getBillingRepository();
    const existingCustomerId = await repo.getStripeCustomerIdForTenant(tenant.id);
    const session = await client.createCheckoutSession({
      tenantId: tenant.id,
      priceId: price_id,
      customerId: existingCustomerId ?? undefined,
      customerEmail: customer_email,
      successUrl: success_url,
      cancelUrl: cancel_url,
      trialPeriodDays: typeof trial_period_days === "number" ? trial_period_days : undefined,
      metadata: { tenant_organization: tenant.organization_name },
    });
    if (session.customerId && !existingCustomerId) {
      await repo.setStripeCustomerId(tenant.id, session.customerId);
    }
    res.json({ status: "ok", checkout_url: session.url, session_id: session.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[billing] checkout failed:", message);
    res.status(500).json({ status: "error", message: "Failed to create checkout session" });
  }
});

// ─── POST /api/v1/billing/portal ─────────────────────────────────────────────
// Body: { return_url: string }
billingRouter.post("/portal", async (req: AuthRequest, res) => {
  const tenant = req.tenant;
  if (!tenant || tenant.id === "local-dev-tenant") {
    res.status(403).json({ status: "error", message: "Authenticated SaaS tenant required" });
    return;
  }
  const { return_url } = req.body ?? {};
  if (!return_url) {
    res.status(400).json({ status: "error", message: "return_url is required" });
    return;
  }
  try {
    const repo = getBillingRepository();
    const customerId = await repo.getStripeCustomerIdForTenant(tenant.id);
    if (!customerId) {
      res.status(400).json({
        status: "error",
        message: "Tenant has no Stripe customer yet. Start with /billing/checkout first.",
      });
      return;
    }
    const session = await getBillingClient().createPortalSession({
      customerId,
      returnUrl: return_url,
    });
    res.json({ status: "ok", portal_url: session.url, session_id: session.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[billing] portal failed:", message);
    res.status(500).json({ status: "error", message: "Failed to create portal session" });
  }
});

// ─── POST /api/v1/billing/webhook ────────────────────────────────────────────
// Stripe Webhook (requires RAW body for signature verification)
// This handler is mounted by the caller AFTER express.raw()
export const billingWebhookHandler = async (req: Request, res: express.Response): Promise<void> => {
  if (!isBillingConfigured()) {
    res.status(503).json({ status: "error", message: "Billing is not configured on this server" });
    return;
  }
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).json({ status: "error", message: "Missing stripe-signature header" });
    return;
  }
  const client = getBillingClient();
  const repo = getBillingRepository();
  const mappings = getPriceMappings();

  try {
    const rawBody = req.body as Buffer;
    const event = client.verifyWebhook(rawBody, signature);

    // 冪等化: 同一 event.id を 2 回処理しない
    const intent = processStripeEvent(event, { priceMappings: mappings });
    const { customerId, subscriptionId, tenantId } = extractTargets(intent);
    const claimed = await repo.claimEvent({
      stripeEventId: event.id,
      eventType: event.type,
      tenantId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      payload: event as unknown as Record<string, unknown>,
    });
    if (!claimed) {
      res.json({ received: true, deduplicated: true });
      return;
    }
    await repo.applyIntent(intent);
    res.json({ received: true, kind: intent.kind });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[billing] webhook failed:", message);
    res.status(400).json({ status: "error", message });
  }
};

function extractTargets(intent: BillingIntent): {
  customerId: string | null;
  subscriptionId: string | null;
  tenantId: string | null;
} {
  switch (intent.kind) {
    case "tenant_subscribed":
      return {
        customerId: intent.stripeCustomerId,
        subscriptionId: intent.stripeSubscriptionId,
        tenantId: intent.tenantId,
      };
    case "tenant_subscription_updated":
      return {
        customerId: intent.stripeCustomerId,
        subscriptionId: intent.stripeSubscriptionId,
        tenantId: null,
      };
    case "tenant_subscription_canceled":
      return {
        customerId: intent.stripeCustomerId,
        subscriptionId: intent.stripeSubscriptionId,
        tenantId: null,
      };
    case "tenant_payment_failed":
      return {
        customerId: intent.stripeCustomerId,
        subscriptionId: intent.stripeSubscriptionId,
        tenantId: null,
      };
    case "noop":
      return { customerId: null, subscriptionId: null, tenantId: null };
  }
}

export default billingRouter;
