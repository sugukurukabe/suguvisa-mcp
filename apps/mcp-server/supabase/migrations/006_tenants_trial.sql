-- Auth0 経由 DCR ユーザーに 14 日 Professional トライアルを提供するためのカラム
-- Add columns for 14-day Professional trial for Auth0 DCR users
-- Tambah kolom untuk uji coba Professional 14 hari bagi pengguna Auth0 DCR

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

COMMENT ON COLUMN public.tenants.trial_ends_at IS
  'Professional トライアル終了日時 / Professional trial end datetime / Akhir uji coba Professional';

CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at
  ON public.tenants (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- 既存の Auth0 経由で auto-provision された Free プランテナントを
-- Professional トライアルに一括アップグレード（公開ディレクトリ向け）
-- Upgrade all existing Auth0 auto-provisioned tenants from free to professional trial
UPDATE public.tenants
SET
  subscription_plan = 'professional',
  subscription_status = 'trialing',
  trial_ends_at = now() + interval '14 days'
WHERE auth0_sub IS NOT NULL
  AND subscription_plan = 'free'
  AND (subscription_status IS NULL OR subscription_status = '');
