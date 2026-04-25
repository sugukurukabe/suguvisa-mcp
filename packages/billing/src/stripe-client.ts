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
 * ワンタイム購入 (チケット / 30日パス等) 用の checkout session 作成パラメータ
 * One-time purchase checkout session args (e.g. 30-day ticket)
 * Parameter sesi checkout sekali beli (mis. tiket 30 hari)
 */
export interface CreateTicketCheckoutArgs {
  tenantId: string;
  priceId: string;
  /** 識別子 (Stripe metadata に保存される。例: "ticket") */
  passKey: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * 課金クライアント抽象
 * Billing client abstraction
 */
export interface BillingClient {
  createCheckoutSession(args: CreateCheckoutArgs): Promise<CheckoutSession>;
  /**
   * ワンタイム購入 (Stripe mode=payment) 用の Checkout Session を作成する。
   * サブスクとは別扱いで、metadata.plan=<passKey> を埋め込む。
   * Create a one-time payment checkout session with metadata.plan=<passKey>.
   * Buat sesi checkout pembayaran sekali (mode=payment) dengan metadata.plan=<passKey>.
   */
  createTicketCheckoutSession(args: CreateTicketCheckoutArgs): Promise<CheckoutSession>;
  createPortalSession(args: CreatePortalArgs): Promise<PortalSession>;
  getSubscription(subscriptionId: string): Promise<SubscriptionSnapshot>;
  /**
   * Checkout session を line_items 込みで再取得する。
   * Retrieve a checkout session with `line_items` expanded so that the price can be resolved.
   * Mengambil sesi checkout dengan `line_items` diperluas agar price dapat diresolusi.
   */
  retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
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
      params.customer_update = { name: "auto", address: "auto" };
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

  async createTicketCheckoutSession(args: CreateTicketCheckoutArgs): Promise<CheckoutSession> {
    const baseMetadata: Record<string, string> = {
      tenant_id: args.tenantId,
      plan: args.passKey,
      ...(args.metadata ?? {}),
    };
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      client_reference_id: args.tenantId,
      // Session レベルと PaymentIntent レベル両方に metadata を入れて webhook 側で参照しやすくする。
      // Attach metadata at both session and payment_intent levels for easier webhook introspection.
      metadata: baseMetadata,
      payment_intent_data: {
        metadata: baseMetadata,
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
    };
    if (args.customerId) {
      params.customer = args.customerId;
      params.customer_update = { name: "auto", address: "auto" };
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

  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    // line_items は Checkout Session のペイロードに含まれず、
    // Stripe Webhook 受信時にも明示 expand が必須
    // line_items are not included in the webhook payload and must be explicitly expanded
    // line_items tidak disertakan dalam payload webhook dan harus di-expand secara eksplisit
    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "line_items.data.price", "subscription"],
    });
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
