-- ============================================
-- 004: テナントと Supabase Auth ユーザーの紐付け
-- Link tenants to Supabase Auth users
-- Menautkan tenants ke pengguna Supabase Auth
-- ============================================
-- 目的 / Purpose / Tujuan:
--   ダッシュボードのサインアップ (auth.users) と SaaS テナント (public.tenants) を
--   自動的に 1:1 で紐付ける。これにより MCP サーバーが Supabase JWT の sub クレーム
--   から tenant を解決できるようになる。
--
--   Linking Supabase auth.users rows to public.tenants rows 1:1 so the MCP server
--   can resolve a tenant from a Supabase JWT's `sub` claim.

-- ---- 1. tenants.auth_user_id 列を追加 ----
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tenants.auth_user_id IS
  'Supabase Auth ユーザー ID / Supabase Auth user id / ID pengguna Supabase Auth';

CREATE INDEX IF NOT EXISTS idx_tenants_auth_user_id
  ON public.tenants (auth_user_id);

-- ---- 2. auth.users 作成時に tenants 行を自動生成 ----
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_name text;
BEGIN
  -- 組織名の既定値を決定。ユーザーメタデータに organization_name があれば優先。
  default_org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    split_part(NEW.email, '@', 1),
    'Tenant-' || substr(NEW.id::text, 1, 8)
  );

  INSERT INTO public.tenants (auth_user_id, organization_name, subscription_plan, status)
  VALUES (NEW.id, default_org_name, 'free', 'active')
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_tenant ON auth.users;

CREATE TRIGGER on_auth_user_created_create_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ---- 3. 既存 auth.users に対して tenants を補填 ----
--   (既にサインアップ済みだが tenant 未作成のユーザー向け)
INSERT INTO public.tenants (auth_user_id, organization_name, subscription_plan, status)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'organization_name',
    split_part(u.email, '@', 1),
    'Tenant-' || substr(u.id::text, 1, 8)
  ),
  'free',
  'active'
FROM auth.users u
LEFT JOIN public.tenants t ON t.auth_user_id = u.id
WHERE t.id IS NULL
ON CONFLICT (auth_user_id) DO NOTHING;
