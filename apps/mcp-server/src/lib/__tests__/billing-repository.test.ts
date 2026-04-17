/**
 * SupabaseBillingRepository のユニットテスト
 * モックの Supabase client を注入して各 BillingIntent が正しい table / column を更新することを検証。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseBillingRepository } from "../billing-repository.js";

type Call = {
  table: string;
  method: "update" | "insert" | "select";
  payload?: Record<string, unknown>;
  match?: Record<string, unknown>;
};

function makeMockSupabase() {
  const calls: Call[] = [];
  const builder = (table: string) => {
    let match: Record<string, unknown> = {};
    const chain = {
      select: vi.fn(() => ({
        eq: (col: string, val: unknown) => {
          match = { ...match, [col]: val };
          return {
            maybeSingle: async () => {
              calls.push({ table, method: "select", match });
              return { data: null, error: null };
            },
          };
        },
      })),
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          calls.push({
            table,
            method: "update",
            payload,
            match: { [col]: val },
          });
          return Promise.resolve({ data: null, error: null });
        },
      })),
      insert: vi.fn((payload: Record<string, unknown>) => ({
        select: () => ({
          maybeSingle: async () => {
            calls.push({ table, method: "insert", payload });
            return { data: { id: "fake-uuid" }, error: null };
          },
        }),
      })),
    };
    return chain;
  };
  const supabase = {
    from: vi.fn((table: string) => builder(table)),
  };
  return { supabase, calls };
}

describe("SupabaseBillingRepository", () => {
  let mock: ReturnType<typeof makeMockSupabase>;
  let repo: SupabaseBillingRepository;

  beforeEach(() => {
    mock = makeMockSupabase();
    repo = new SupabaseBillingRepository({
      supabase: mock.supabase as unknown as SupabaseClient,
    });
  });

  it("applies tenant_subscribed via tenants.update(id)", async () => {
    await repo.applyIntent({
      kind: "tenant_subscribed",
      tenantId: "t1",
      plan: "starter",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_s_m",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00Z",
      cancelAtPeriodEnd: false,
    });
    const call = mock.calls[0]!;
    expect(call.table).toBe("tenants");
    expect(call.method).toBe("update");
    expect(call.payload).toMatchObject({
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      subscription_plan: "starter",
      subscription_status: "active",
    });
    expect(call.match).toEqual({ id: "t1" });
  });

  it("applies subscription_updated via tenants.update(stripe_customer_id)", async () => {
    await repo.applyIntent({
      kind: "tenant_subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      plan: "professional",
      stripePriceId: "price_p_m",
      status: "active",
      currentPeriodEnd: "2026-06-01T00:00:00Z",
      cancelAtPeriodEnd: true,
    });
    const call = mock.calls[0]!;
    expect(call.payload).toMatchObject({
      subscription_plan: "professional",
      subscription_cancel_at_period_end: true,
    });
    expect(call.match).toEqual({ stripe_customer_id: "cus_1" });
  });

  it("applies subscription_canceled by downgrading to free", async () => {
    await repo.applyIntent({
      kind: "tenant_subscription_canceled",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    const call = mock.calls[0]!;
    expect(call.payload).toMatchObject({
      subscription_plan: "free",
      subscription_status: "canceled",
    });
  });

  it("applies payment_failed as past_due", async () => {
    await repo.applyIntent({
      kind: "tenant_payment_failed",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    const call = mock.calls[0]!;
    expect(call.payload).toMatchObject({ subscription_status: "past_due" });
  });

  it("noop intent does not touch the database", async () => {
    await repo.applyIntent({ kind: "noop", reason: "x" });
    expect(mock.calls).toHaveLength(0);
  });

  it("claimEvent inserts into billing_events and returns true on first claim", async () => {
    const claimed = await repo.claimEvent({
      stripeEventId: "evt_1",
      eventType: "customer.subscription.updated",
      tenantId: null,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      payload: { foo: "bar" },
    });
    expect(claimed).toBe(true);
    const call = mock.calls[0]!;
    expect(call.table).toBe("billing_events");
    expect(call.method).toBe("insert");
    expect(call.payload).toMatchObject({
      stripe_event_id: "evt_1",
      event_type: "customer.subscription.updated",
    });
  });
});
