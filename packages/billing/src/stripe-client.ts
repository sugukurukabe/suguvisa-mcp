/**
 * Stripe クライアントラッパー
 * Stripe client wrapper
 * Pembungkus klien Stripe
 *
 * stripe SDK の薄いラッパーだが、テスト用に `BillingClient` インターフェースで
 * 抽象化しているので `FakeBillingClient` と差し替えられる。
 */
import Stripe from "stripe";

export interface CheckoutSession {
  id: string;
  url: string | null;
  customerId: string | null;
}

export interface PortalSession {
  id: string;
  url: string;
}

export interface SubscriptionSnapshot {
  id: string;
  status: Stripe.Subscription.Status;
  customerId: string;
  priceId: string;
  currentPeriodEnd: string; // ISO timestamp
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, string>;
}

export interface CreateCheckoutArgs {
  tenantId: string;
  priceId: string;
  /** 既存 Stripe customer がある場合は再利用 */
  customerId?: string;
  /** Stripe への事前登録メール (新規作成時のみ) */
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  /** trial 日数 (省略時なし) */
  trialPeriodDays?: number;
  /** Stripe の subscription メタデータに追加するキー */
  metadata?: Record<string, string>;
}

export interface CreatePortalArgs {
  customerId: string;
  returnUrl: string;
}

/**
 * 課金クライアント抽象
 * Billing client abstraction
 */
export interface BillingClient {
  createCheckoutSession(args: CreateCheckoutArgs): Promise<CheckoutSession>;
  createPortalSession(args: CreatePortalArgs): Promise<PortalSession>;
  getSubscription(subscriptionId: string): Promise<SubscriptionSnapshot>;
  /** Stripe webhook の署名検証と event パースを委譲する */
  verifyWebhook(payload: string | Buffer, signature: string): Stripe.Event;
}

export interface StripeBillingClientOptions {
  apiKey: string;
  webhookSecret: string;
  /** Stripe API バージョン (既定: アカウントに紐づくデフォルト) */
  apiVersion?: Stripe.LatestApiVersion;
}

export class StripeBillingClient implements BillingClient {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(options: StripeBillingClientOptions) {
    this.stripe = new Stripe(options.apiKey, {
      apiVersion: options.apiVersion ?? ("2025-02-24.acacia" as Stripe.LatestApiVersion),
      appInfo: { name: "suguvisa-mcp", version: "0.1.0" },
    });
    this.webhookSecret = options.webhookSecret;
  }

  async createCheckoutSession(args: CreateCheckoutArgs): Promise<CheckoutSession> {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      client_reference_id: args.tenantId,
      subscription_data: {
        metadata: { tenant_id: args.tenantId, ...(args.metadata ?? {}) },
        ...(args.trialPeriodDays ? { trial_period_days: args.trialPeriodDays } : {}),
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
    };
    if (args.customerId) {
      params.customer = args.customerId;
    } else if (args.customerEmail) {
      params.customer_email = args.customerEmail;
    }

    const session = await this.stripe.checkout.sessions.create(params);
    const customer = session.customer;
    return {
      id: session.id,
      url: session.url ?? null,
      customerId: typeof customer === "string" ? customer : (customer?.id ?? null),
    };
  }

  async createPortalSession(args: CreatePortalArgs): Promise<PortalSession> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: args.customerId,
      return_url: args.returnUrl,
    });
    return { id: session.id, url: session.url };
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionSnapshot> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    return toSnapshot(sub);
  }

  verifyWebhook(payload: string | Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}

export function toSnapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? "";
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end;
  return {
    id: sub.id,
    status: sub.status,
    customerId,
    priceId,
    currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    metadata: (sub.metadata ?? {}) as Record<string, string>,
  };
}
