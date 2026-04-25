-- =========================================
-- 007 Ticket (one-time 30-day pass) support
-- チケット (30日パス / ワンタイム購入) 対応カラムと監査テーブル
-- Dukungan kartu tiket (pass 30 hari / pembelian sekali)
-- =========================================
--
-- 概要: サブスク加入せずに ¥2,980 で 30 日間 Starter 相当の機能を使えるプラン。
-- Stripe で mode='payment' (one-time) として Checkout Session を作成し、
-- webhook で metadata.plan='ticket' を検知して tenants.ticket_expires_at を延長する。
--
-- サブスクとは完全に直交: 既に starter/professional サブスクを持っていても購入可能
-- （効果は単に ticket_expires_at を延ばすだけで、実効プラン計算では
-- 「サブスクとチケットのうち高い方」を取るので意味のある課金にならない）。
-- 同様に、チケットを消費中に starter/professional にアップグレードすれば、
-- チケットは残ったまま放置される（影響なし）。
--
-- 有効チェック: tenants.ticket_expires_at IS NOT NULL AND ticket_expires_at > now()
-- 延長ルール (stack):
--   既存 expires_at > now  →  expires_at = existing_expires_at + 30 days
--   既存 expires_at <= now → expires_at = now() + 30 days

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ticket_expires_at timestamptz;

COMMENT ON COLUMN public.tenants.ticket_expires_at IS
  'チケット (30日パス) の有効期限。now() より未来なら Starter 相当のアクセスを付与する。'
  ' / Ticket (30-day pass) expiry. Grants Starter-tier access while > now().'
  ' / Tenggat pass tiket (30 hari). Memberikan akses setara Starter selama > now().';

CREATE INDEX IF NOT EXISTS idx_tenants_ticket_expires_at
  ON public.tenants (ticket_expires_at)
  WHERE ticket_expires_at IS NOT NULL;

-- チケット購入履歴テーブル
-- Ticket purchase history table
-- Tabel riwayat pembelian tiket
CREATE TABLE IF NOT EXISTS public.ticket_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  amount_jpy integer NOT NULL,
  duration_days integer NOT NULL,
  granted_plan text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  previous_expires_at timestamptz,
  new_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_purchases_tenant
  ON public.ticket_purchases (tenant_id, purchased_at DESC);

-- RLS: service_role 以外は読めない (個人情報に近い扱い)
ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public read on ticket_purchases" ON public.ticket_purchases;
CREATE POLICY "Deny public read on ticket_purchases"
  ON public.ticket_purchases FOR SELECT USING (false);

DROP POLICY IF EXISTS "Deny public insert on ticket_purchases" ON public.ticket_purchases;
CREATE POLICY "Deny public insert on ticket_purchases"
  ON public.ticket_purchases FOR INSERT WITH CHECK (false);
