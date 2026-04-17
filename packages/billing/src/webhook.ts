/**
 * Webhook ハンドラー / Webhook handler / Penangan webhook
 *
 * Stripe からのイベントを受け取り、テナントの課金状態を更新する。
 * Receives Stripe events and updates tenant billing state.
 *
 * サポートするイベント:
 *  - checkout.session.completed
 *  - customer.subscription.created
 *  - customer.subscription.updated
 *  - customer.subscription.deleted
 *  - invoice.payment_failed
 */
import type Stripe from "stripe";
import type { BillingClient } from "./stripe-client.js";
import {
  type PlanKey,
  type PriceMapping,
  resolvePlanFromPriceId,
} from "./plans.js";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

/**
 * Webhook 処理の結果として repository に依頼する副作用の記述。
 * An intention to update tenant billing state, returned from the handler
 * and applied by the repository layer. This separation makes the handler
 * pure and testable.
 */
export type BillingIntent =
  | {
      kind: "tenant_subscribed";
      tenantId: string;
      plan: PlanKey;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      stripePriceId: string;
      status: SubscriptionStatus;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    }
  | {
      kind: "tenant_subscription_updated";
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      plan: PlanKey;
      stripePriceId: string;
      status: SubscriptionStatus;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    }
  | {
      kind: "tenant_subscription_canceled";
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    }
  | {
      kind: "tenant_payment_failed";
      stripeCustomerId: string;
      stripeSubscriptionId: string | null;
    }
  | { kind: "noop"; reason: string };

export interface WebhookHandlerOptions {
  priceMappings: PriceMapping[];
  /** mappings に無い priceId だった場合のフォールバックプラン (既定: free) */
  fallbackPlan?: PlanKey;
}

/**
 * Stripe イベントを BillingIntent に変換する純関数ラッパー。
 * Pure function: Stripe event → BillingIntent. Side effects live in the caller.
 */
export function processStripeEvent(
  event: Stripe.Event,
  options: WebhookHandlerOptions,
): BillingIntent {
  const fallback = options.fallbackPlan ?? "free";
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.client_reference_id ?? undefined;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!tenantId || !subscriptionId || !customerId) {
        return {
          kind: "noop",
          reason: "checkout.session.completed missing tenantId / subscription / customer",
        };
      }
      const priceId = extractPriceFromSession(session);
      const plan = priceId ? resolvePlanFromPriceId(priceId, options.priceMappings) ?? fallback : fallback;
      return {
        kind: "tenant_subscribed",
        tenantId,
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId ?? "",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
        cancelAtPeriodEnd: false,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id;
      if (!priceId) {
        return { kind: "noop", reason: "subscription has no price" };
      }
      const plan = resolvePlanFromPriceId(priceId, options.priceMappings) ?? fallback;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end;
      return {
        kind: "tenant_subscription_updated",
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        plan,
        stripePriceId: priceId,
        status: sub.status as SubscriptionStatus,
        currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      return {
        kind: "tenant_subscription_canceled",
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
      };
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? "";
      const subscriptionId =
        typeof (inv as unknown as { subscription?: string | { id: string } }).subscription === "string"
          ? ((inv as unknown as { subscription: string }).subscription)
          : ((inv as unknown as { subscription?: { id: string } }).subscription?.id ?? null);
      return {
        kind: "tenant_payment_failed",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      };
    }
    default:
      return { kind: "noop", reason: `unhandled event: ${event.type}` };
  }
}

function extractPriceFromSession(session: Stripe.Checkout.Session): string | null {
  // line_items は expand しないと取れないため、subscription からの fallback も用意
  const items = (session as unknown as { line_items?: { data?: Array<{ price?: { id: string } }> } }).line_items;
  const fromItems = items?.data?.[0]?.price?.id;
  if (fromItems) return fromItems;
  // Stripe は session.metadata にも price を入れていないので null を返すしかない
  return null;
}

/**
 * Repository インターフェース — webhook 結果の永続化を担う。
 * Repository interface for persisting webhook outcomes.
 */
export interface BillingRepository {
  applyIntent(intent: BillingIntent): Promise<void>;
}

/**
 * 高レベルの便利関数: 署名検証 → イベントパース → repository への適用。
 */
export async function handleWebhook(args: {
  client: BillingClient;
  repository: BillingRepository;
  payload: string | Buffer;
  signature: string;
  options: WebhookHandlerOptions;
}): Promise<{ event: Stripe.Event; intent: BillingIntent }> {
  const event = args.client.verifyWebhook(args.payload, args.signature);
  const intent = processStripeEvent(event, args.options);
  await args.repository.applyIntent(intent);
  return { event, intent };
}
