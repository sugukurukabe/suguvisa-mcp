/**
 * FakeBillingClient — テスト / ローカル開発用のインメモリ実装
 * In-memory fake billing client for tests and local development
 * Klien billing palsu untuk pengujian dan pengembangan lokal
 *
 * Stripe を呼ばずに checkout URL を模倣し、署名検証も
 * 単純な secret 比較で代用する。
 */
import type Stripe from "stripe";
import type {
  BillingClient,
  CheckoutSession,
  CreateCheckoutArgs,
  CreatePortalArgs,
  CreateTicketCheckoutArgs,
  PortalSession,
  SubscriptionSnapshot,
} from "./stripe-client.js";

export interface FakeBillingClientOptions {
  webhookSecret?: string;
  /** checkout session で返す URL のベース */
  baseUrl?: string;
}

export class FakeBillingClient implements BillingClient {
  readonly sessions: Array<{ id: string; args: CreateCheckoutArgs }> = [];
  readonly ticketSessions: Array<{ id: string; args: CreateTicketCheckoutArgs }> = [];
  readonly portals: Array<{ id: string; args: CreatePortalArgs }> = [];
  readonly subscriptions = new Map<string, SubscriptionSnapshot>();
  /** テスト用: retrieveCheckoutSession の返却値をあらかじめ登録する */
  readonly checkoutSessionsById = new Map<string, Stripe.Checkout.Session>();
  private readonly webhookSecret: string;
  private readonly baseUrl: string;
  private counter = 0;

  constructor(options: FakeBillingClientOptions = {}) {
    this.webhookSecret = options.webhookSecret ?? "whsec_fake";
    this.baseUrl = options.baseUrl ?? "https://fake.suguvisa.local";
  }

  async createCheckoutSession(args: CreateCheckoutArgs): Promise<CheckoutSession> {
    this.counter += 1;
    const id = `cs_test_${this.counter}`;
    this.sessions.push({ id, args });
    const customerId = args.customerId ?? `cus_fake_${this.counter}`;
    return {
      id,
      url: `${this.baseUrl}/checkout/${id}`,
      customerId,
    };
  }

  async createTicketCheckoutSession(args: CreateTicketCheckoutArgs): Promise<CheckoutSession> {
    this.counter += 1;
    const id = `cs_test_ticket_${this.counter}`;
    this.ticketSessions.push({ id, args });
    const customerId = args.customerId ?? `cus_fake_${this.counter}`;
    return {
      id,
      url: `${this.baseUrl}/checkout/${id}?mode=payment`,
      customerId,
    };
  }

  async createPortalSession(args: CreatePortalArgs): Promise<PortalSession> {
    this.counter += 1;
    const id = `ps_test_${this.counter}`;
    this.portals.push({ id, args });
    return { id, url: `${this.baseUrl}/portal/${id}` };
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionSnapshot> {
    const snap = this.subscriptions.get(subscriptionId);
    if (!snap) throw new Error(`subscription ${subscriptionId} not found`);
    return snap;
  }

  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const session = this.checkoutSessionsById.get(sessionId);
    if (!session) throw new Error(`checkout session ${sessionId} not found`);
    return session;
  }

  /**
   * Stripe 署名の代わりに、`signature === webhookSecret` であれば受理する。
   * payload は既に JSON シリアライズ済みの Stripe.Event とみなす。
   */
  verifyWebhook(payload: string | Buffer, signature: string): Stripe.Event {
    if (signature !== this.webhookSecret) {
      throw new Error("invalid fake webhook signature");
    }
    const json = typeof payload === "string" ? payload : payload.toString("utf-8");
    return JSON.parse(json) as Stripe.Event;
  }
}
