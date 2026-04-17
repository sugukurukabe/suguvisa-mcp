/**
 * Supabase ベースの BillingRepository 実装
 *
 * Stripe webhook の結果 (BillingIntent) を受け取り、tenants / billing_events に
 * 反映する。イベント ID による冪等化も担当する。
 */
import type { BillingIntent, BillingRepository } from "@suguvisa/billing";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseBillingRepositoryOptions {
  supabase: SupabaseClient;
}

export class SupabaseBillingRepository implements BillingRepository {
  private readonly supabase: SupabaseClient;

  constructor(options: SupabaseBillingRepositoryOptions) {
    this.supabase = options.supabase;
  }

  async applyIntent(intent: BillingIntent): Promise<void> {
    switch (intent.kind) {
      case "tenant_subscribed": {
        await this.upsertTenantSubscription({
          tenantId: intent.tenantId,
          stripeCustomerId: intent.stripeCustomerId,
          stripeSubscriptionId: intent.stripeSubscriptionId,
          stripePriceId: intent.stripePriceId,
          plan: intent.plan,
          status: intent.status,
          currentPeriodEnd: intent.currentPeriodEnd,
          cancelAtPeriodEnd: intent.cancelAtPeriodEnd,
        });
        return;
      }
      case "tenant_subscription_updated": {
        await this.supabase
          .from("tenants")
          .update({
            stripe_subscription_id: intent.stripeSubscriptionId,
            stripe_price_id: intent.stripePriceId,
            subscription_plan: intent.plan,
            subscription_status: intent.status,
            subscription_current_period_end: intent.currentPeriodEnd,
            subscription_cancel_at_period_end: intent.cancelAtPeriodEnd,
            subscription_updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", intent.stripeCustomerId);
        return;
      }
      case "tenant_subscription_canceled": {
        await this.supabase
          .from("tenants")
          .update({
            subscription_plan: "free",
            subscription_status: "canceled",
            subscription_cancel_at_period_end: false,
            subscription_updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", intent.stripeCustomerId);
        return;
      }
      case "tenant_payment_failed": {
        await this.supabase
          .from("tenants")
          .update({
            subscription_status: "past_due",
            subscription_updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", intent.stripeCustomerId);
        return;
      }
      case "noop":
        return;
    }
  }

  /**
   * Stripe event id を使って冪等に処理する。既に処理済みなら false を返す。
   */
  async claimEvent(args: {
    stripeEventId: string;
    eventType: string;
    tenantId: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    payload: unknown;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("billing_events")
      .insert({
        stripe_event_id: args.stripeEventId,
        event_type: args.eventType,
        tenant_id: args.tenantId,
        stripe_customer_id: args.stripeCustomerId,
        stripe_subscription_id: args.stripeSubscriptionId,
        payload: args.payload as Record<string, unknown>,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // 一意制約違反 (23505) なら既に処理済み → 冪等に return false
      if ((error as { code?: string }).code === "23505") return false;
      throw error;
    }
    return Boolean(data);
  }

  async findTenantByCustomerId(stripeCustomerId: string): Promise<{ id: string } | null> {
    const { data } = await this.supabase
      .from("tenants")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    return (data as { id: string } | null) ?? null;
  }

  async getStripeCustomerIdForTenant(tenantId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenantId)
      .maybeSingle();
    return (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
  }

  async setStripeCustomerId(tenantId: string, stripeCustomerId: string): Promise<void> {
    await this.supabase
      .from("tenants")
      .update({
        stripe_customer_id: stripeCustomerId,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
  }

  private async upsertTenantSubscription(args: {
    tenantId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    plan: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  }): Promise<void> {
    await this.supabase
      .from("tenants")
      .update({
        stripe_customer_id: args.stripeCustomerId,
        stripe_subscription_id: args.stripeSubscriptionId,
        stripe_price_id: args.stripePriceId,
        subscription_plan: args.plan,
        subscription_status: args.status,
        subscription_current_period_end: args.currentPeriodEnd,
        subscription_cancel_at_period_end: args.cancelAtPeriodEnd,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", args.tenantId);
  }
}
