-- =========================================
-- Phase 3 Task 3.1 Stripe Billing
-- Stripe Subscriptions 連携用のカラム追加とイベント監査テーブル
-- =========================================

-- 1. tenants テーブルに Stripe 紐付けカラムを追加
-- tenants.subscription_plan はすでに存在 (free/starter/professional/unlimited)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
    -- trialing / active / past_due / canceled / unpaid / incomplete / paused
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON public.tenants (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_subscription ON public.tenants (stripe_subscription_id);

-- 2. Stripe Webhook の冪等性を担保するログテーブル
-- 同じ event.id を 2 回受信しても副作用が起きないようにするため。
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  payload jsonb NOT NULL,
  processed_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON public.billing_events (tenant_id, processed_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON public.billing_events (event_type, processed_at);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public read on billing_events"
  ON public.billing_events FOR SELECT USING (false);
CREATE POLICY "Deny public insert on billing_events"
  ON public.billing_events FOR INSERT WITH CHECK (false);

-- 3. tenants に updated_at 自動更新トリガを追加 (存在チェック)
-- supabase は trigger 定義の冪等性保証が弱いので DO ブロックで条件付き作成。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE FUNCTION public.set_updated_at() RETURNS trigger AS $trg$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $trg$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenants_updated_at'
  ) THEN
    CREATE TRIGGER trg_tenants_updated_at
      BEFORE UPDATE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
