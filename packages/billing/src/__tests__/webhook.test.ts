import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { FakeBillingClient } from "../fake.js";
import type { BillingIntent, BillingRepository } from "../webhook.js";
import { handleWebhook, processStripeEvent } from "../webhook.js";

const MAPPING = [
  { priceId: "price_starter_m", plan: "starter" as const, interval: "month" as const },
  { priceId: "price_pro_m", plan: "professional" as const, interval: "month" as const },
];

function makeEvent<T>(type: string, object: T): Stripe.Event {
  return {
    id: "evt_test",
    object: "event",
    type,
    api_version: "2024-01-01",
    created: 1700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: { object } as unknown as Stripe.Event.Data,
  } as Stripe.Event;
}

describe("processStripeEvent", () => {
  it("maps checkout.session.completed to tenant_subscribed", () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_1",
      client_reference_id: "tenant-abc",
      customer: "cus_1",
      subscription: "sub_1",
      line_items: { data: [{ price: { id: "price_pro_m" } }] },
    });
    const intent = processStripeEvent(event, { priceMappings: MAPPING });
    expect(intent.kind).toBe("tenant_subscribed");
    if (intent.kind !== "tenant_subscribed") throw new Error("wrong kind");
    expect(intent.tenantId).toBe("tenant-abc");
    expect(intent.plan).toBe("professional");
    expect(intent.stripeSubscriptionId).toBe("sub_1");
  });

  it("returns noop when checkout is missing tenant", () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_1",
      customer: "cus_1",
      subscription: "sub_1",
    });
    const intent = processStripeEvent(event, { priceMappings: MAPPING });
    expect(intent.kind).toBe("noop");
  });

  it("maps subscription.updated to plan change", () => {
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: true,
      current_period_end: 1800_000_000,
      items: { data: [{ price: { id: "price_starter_m" } }] },
    });
    const intent = processStripeEvent(event, { priceMappings: MAPPING });
    expect(intent.kind).toBe("tenant_subscription_updated");
    if (intent.kind !== "tenant_subscription_updated") throw new Error();
    expect(intent.plan).toBe("starter");
    expect(intent.cancelAtPeriodEnd).toBe(true);
  });

  it("falls back to free when price not mapped", () => {
    const event = makeEvent("customer.subscription.created", {
      id: "sub_x",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: false,
      current_period_end: 1800_000_000,
      items: { data: [{ price: { id: "price_unknown" } }] },
    });
    const intent = processStripeEvent(event, { priceMappings: MAPPING });
    expect(intent.kind).toBe("tenant_subscription_updated");
    if (intent.kind !== "tenant_subscription_updated") throw new Error();
    expect(intent.plan).toBe("free");
  });

  it("maps subscription.deleted to canceled", () => {
    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_1",
      customer: "cus_1",
      status: "canceled",
      cancel_at_period_end: false,
      current_period_end: 1700_000_000,
      items: { data: [] },
    });
    const intent = processStripeEvent(event, { priceMappings: MAPPING });
    expect(intent.kind).toBe("tenant_subscription_canceled");
  });

  it("maps invoice.payment_failed", () => {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_1",
      customer: "cus_1",
      subscription: "sub_1",
    });
    const intent = processStripeEvent(event, { priceMappings: MAPPING });
    expect(intent.kind).toBe("tenant_payment_failed");
  });

  it("noop for unknown events", () => {
    const intent = processStripeEvent(makeEvent("ping", {}), {
      priceMappings: MAPPING,
    });
    expect(intent.kind).toBe("noop");
  });
});

describe("handleWebhook end-to-end with fake client + repository", () => {
  it("verifies signature and applies intent", async () => {
    const client = new FakeBillingClient({ webhookSecret: "whsec_fake" });
    const applied: BillingIntent[] = [];
    const repository: BillingRepository = {
      applyIntent: vi.fn(async (intent) => {
        applied.push(intent);
      }),
    };
    const payload = JSON.stringify(
      makeEvent("customer.subscription.updated", {
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        cancel_at_period_end: false,
        current_period_end: 1800_000_000,
        items: { data: [{ price: { id: "price_starter_m" } }] },
      }),
    );
    const result = await handleWebhook({
      client,
      repository,
      payload,
      signature: "whsec_fake",
      options: { priceMappings: MAPPING },
    });
    expect(result.intent.kind).toBe("tenant_subscription_updated");
    expect(applied).toHaveLength(1);
  });

  it("throws when signature mismatch", async () => {
    const client = new FakeBillingClient({ webhookSecret: "whsec_fake" });
    const repository: BillingRepository = {
      applyIntent: vi.fn(),
    };
    await expect(
      handleWebhook({
        client,
        repository,
        payload: "{}",
        signature: "wrong",
        options: { priceMappings: MAPPING },
      }),
    ).rejects.toThrow(/invalid/);
    expect(repository.applyIntent).not.toHaveBeenCalled();
  });
});

describe("FakeBillingClient checkout & portal", () => {
  it("records checkout sessions and returns a URL", async () => {
    const client = new FakeBillingClient();
    const s = await client.createCheckoutSession({
      tenantId: "tenant-1",
      priceId: "price_starter_m",
      successUrl: "https://x/success",
      cancelUrl: "https://x/cancel",
    });
    expect(s.id).toMatch(/^cs_test_/);
    expect(s.url).toContain(s.id);
    expect(client.sessions).toHaveLength(1);
  });

  it("records portal sessions", async () => {
    const client = new FakeBillingClient();
    const p = await client.createPortalSession({
      customerId: "cus_1",
      returnUrl: "https://x/settings",
    });
    expect(p.url).toContain(p.id);
    expect(client.portals).toHaveLength(1);
  });
});
