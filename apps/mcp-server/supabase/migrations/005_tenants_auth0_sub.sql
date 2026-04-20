-- ────────────────────────────────────────────────────────────────
-- 005: Auth0 ユーザーを tenants に紐付けるための auth0_sub カラム追加
-- 005: Add auth0_sub column to link Auth0 users to tenants
-- 005: Menambah kolom auth0_sub untuk menautkan user Auth0 ke tenants
-- ────────────────────────────────────────────────────────────────
-- 背景 / Background / Latar belakang:
--   Claude Connectors / ChatGPT Apps 経由のユーザーは Auth0 でサインアップされ、
--   Supabase auth.users には作成されないため、既存の auth_user_id だけでは
--   紐付けできない。Auth0 の `sub` (例: "auth0|abc123") を格納する専用列を追加。

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auth0_sub text UNIQUE;

COMMENT ON COLUMN public.tenants.auth0_sub IS
  'Auth0 の sub クレーム (例: auth0|abc123) / Auth0 subject claim / Klaim subject Auth0';

CREATE INDEX IF NOT EXISTS idx_tenants_auth0_sub
  ON public.tenants (auth0_sub)
  WHERE auth0_sub IS NOT NULL;
