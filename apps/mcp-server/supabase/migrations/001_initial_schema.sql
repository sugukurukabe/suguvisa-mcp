-- =========================================
-- SuguVisa MCP SaaS Database Schema
-- =========================================

-- 1. テナント（プランなど企業情報）テーブル
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_name text NOT NULL,
  subscription_plan text NOT NULL DEFAULT 'free', -- e.g., 'free', 'basic', 'premium'
  status text NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. APIキー 管理テーブル
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active', -- 'active', 'revoked'
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  last_used_at timestamp with time zone
);

-- 3. 利用状況・ログテーブル（従量課金やエラー監視用）
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tool_name text NOT NULL, -- e.g. 'suguvisa_residence_card_parse'
  status text NOT NULL, -- e.g. 'success', 'error'
  duration_ms integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- インデックスの作成（アクセス頻度が高いので）
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON public.api_keys (key);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_tenant ON public.api_usage_logs (tenant_id, created_at);

-- RLS (Row Level Security) の設定
-- SaaS サービスの内部（サーバー側）からのみアクセスされるため、基本的には
-- サービスキーを用いてアクセスし、クライアントからの匿名アクセスは全て拒否します。
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- 念のため、パブリックアクセスをすべて拒否するポリシー（デフォルト動作の明示）
CREATE POLICY "Deny public read on tenants" ON public.tenants FOR SELECT USING (false);
CREATE POLICY "Deny public read on api_keys" ON public.api_keys FOR SELECT USING (false);
CREATE POLICY "Deny public insert on api_usage_logs" ON public.api_usage_logs FOR INSERT WITH CHECK (false);

-- =========================================
-- 4. 申請結果フィードバック（HITL自己改善ループ）
-- =========================================
-- 入管への申請結果（通過・補正・不受理）を構造化して記録する。
-- suguvisa_submission_outcome_track ツールから書き込まれ、
-- 同一パターンの補正率をベイズ推論的に算出するための教師データとなる。

CREATE TABLE IF NOT EXISTS public.submission_outcomes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- 申請パターン情報
  -- 申請パターン情報 / Application pattern info
  pattern_id text NOT NULL,           -- e.g. "CHANGE_SSW1_C"
  lookup_key text NOT NULL,           -- e.g. "技能実習2号_特定技能1号"
  industry_field text,                -- e.g. "農業"

  -- 生成メタデータ / Generation metadata
  document_hash text,                 -- 生成書類のSHA-256
  rule_set_version text NOT NULL,     -- e.g. "2026-04-01"

  -- 入管からの結果 / Immigration result
  result text NOT NULL CHECK (result IN ('ACCEPTED', 'REVISION_REQUIRED', 'REJECTED', 'PENDING')),
  revision_codes text[],              -- 補正指示のエラーコード群
  revision_details text,              -- 補正内容テキスト

  -- AI品質メタデータ / AI quality metadata
  confidence_score numeric(3,2),      -- 0.00〜1.00
  agent_model text,                   -- 使用LLMモデル名

  -- タイムライン / Timeline
  submitted_at timestamp with time zone,
  result_received_at timestamp with time zone,
  immigration_office text,            -- 提出した入管局

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_pattern ON public.submission_outcomes (pattern_id, result);
CREATE INDEX IF NOT EXISTS idx_outcomes_tenant ON public.submission_outcomes (tenant_id, created_at);

ALTER TABLE public.submission_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public read on submission_outcomes"
  ON public.submission_outcomes FOR SELECT USING (false);

-- =========================================
-- 5. 監査証跡（Audit Trail）基盤
-- =========================================
-- ビジネスイベントのトラッキング用。いつ、誰が、何を対象にどのアクションを行ったか記録する。
-- 例：書類生成の完了、電子届出の提出完了、エラー発生等。

CREATE TABLE IF NOT EXISTS public.visa_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- 実行者情報
  actor text NOT NULL,                -- e.g. "SuguKuru Core", "Human_Taro", "VisaWizard AI"
  
  -- イベント内容
  action_type text NOT NULL,          -- e.g. "GENERATE_ANNUAL_REPORT", "DOWNLOAD_BULK_EXCEL", "VALIDATE_DATA"
  target_resource text,               -- e.g. "case_id: 123", "GILANG PERMANA" などの対象特定IDや氏名
  
  -- メタデータ（入力情報や設定値など）
  metadata jsonb,                     -- JSON形式で状態や入力引数を保存
  
  -- タイムライン
  created_at timestamp with time zone DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at ON public.visa_audit_logs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.visa_audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.visa_audit_logs (target_resource);

-- RLS (Row Level Security)
ALTER TABLE public.visa_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public read on visa_audit_logs"
  ON public.visa_audit_logs FOR SELECT USING (false);
CREATE POLICY "Deny public insert on visa_audit_logs"
  ON public.visa_audit_logs FOR INSERT WITH CHECK (false);
