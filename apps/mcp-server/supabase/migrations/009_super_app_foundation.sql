-- SuguVisa スーパーアプリ基盤: Calendar / Workspace / Intake / Review / Analytics
-- SuguVisa super app foundation: Calendar / Workspace / Intake / Review / Analytics
-- Fondasi super app SuguVisa: Calendar / Workspace / Intake / Review / Analytics

CREATE TABLE IF NOT EXISTS public.workspace_oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  principal_subject text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google_calendar', 'google_workspace', 'gmail', 'drive')),
  scopes text[] NOT NULL DEFAULT '{}',
  token_secret_ref text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'error')),
  last_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_oauth_unique_principal_provider
  ON public.workspace_oauth_connections (tenant_id, principal_subject, provider);

CREATE TABLE IF NOT EXISTS public.calendar_sync_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.workspace_oauth_connections(id) ON DELETE SET NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  deadline_type text NOT NULL,
  calendar_provider text NOT NULL DEFAULT 'google_calendar',
  calendar_id text NOT NULL,
  provider_event_id text NOT NULL,
  sync_direction text NOT NULL DEFAULT 'one_way_from_suguvisa'
    CHECK (sync_direction IN ('one_way_from_suguvisa', 'human_confirmed_update')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'needs_resync', 'error')),
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sync_links_provider_event
  ON public.calendar_sync_links (tenant_id, calendar_provider, calendar_id, provider_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sync_links_source_deadline
  ON public.calendar_sync_links (tenant_id, source_table, source_id, deadline_type);

CREATE TABLE IF NOT EXISTS public.document_intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_system text NOT NULL CHECK (source_system IN ('gmail', 'drive', 'manual_upload', 'calendar')),
  source_external_id text,
  case_id uuid,
  gcs_object_registry_id uuid,
  detected_document_type text,
  intake_status text NOT NULL DEFAULT 'received'
    CHECK (intake_status IN ('received', 'classified', 'linked', 'needs_review', 'rejected')),
  raw_image_persisted boolean NOT NULL DEFAULT false,
  human_review_required boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_intake_events_tenant_status
  ON public.document_intake_events (tenant_id, intake_status, created_at);
CREATE INDEX IF NOT EXISTS idx_document_intake_events_case
  ON public.document_intake_events (tenant_id, case_id);

CREATE TABLE IF NOT EXISTS public.expert_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id uuid,
  trigger_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  route_to text NOT NULL CHECK (route_to IN ('admin_staff', 'immigration_lawyer', 'lawyer', 'manager')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'approved', 'rejected', 'resolved')),
  required_evidence text[] NOT NULL DEFAULT '{}',
  decision_summary text,
  decided_by text,
  decided_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_review_queue_tenant_status
  ON public.expert_review_queue (tenant_id, status, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_expert_review_queue_case
  ON public.expert_review_queue (tenant_id, case_id);

CREATE TABLE IF NOT EXISTS public.super_app_kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kpi_id text NOT NULL,
  grain text NOT NULL CHECK (grain IN ('daily', 'weekly', 'monthly', 'case')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric NOT NULL,
  target_direction text NOT NULL CHECK (target_direction IN ('increase', 'decrease', 'zero')),
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_super_app_kpi_snapshots_unique_period
  ON public.super_app_kpi_snapshots (tenant_id, kpi_id, grain, period_start, period_end);

ALTER TABLE public.workspace_oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_intake_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_app_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny public read on workspace_oauth_connections"
  ON public.workspace_oauth_connections FOR SELECT USING (false);
CREATE POLICY "Deny public write on workspace_oauth_connections"
  ON public.workspace_oauth_connections FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Deny public read on calendar_sync_links"
  ON public.calendar_sync_links FOR SELECT USING (false);
CREATE POLICY "Deny public write on calendar_sync_links"
  ON public.calendar_sync_links FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Deny public read on document_intake_events"
  ON public.document_intake_events FOR SELECT USING (false);
CREATE POLICY "Deny public write on document_intake_events"
  ON public.document_intake_events FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Deny public read on expert_review_queue"
  ON public.expert_review_queue FOR SELECT USING (false);
CREATE POLICY "Deny public write on expert_review_queue"
  ON public.expert_review_queue FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Deny public read on super_app_kpi_snapshots"
  ON public.super_app_kpi_snapshots FOR SELECT USING (false);
CREATE POLICY "Deny public write on super_app_kpi_snapshots"
  ON public.super_app_kpi_snapshots FOR ALL USING (false) WITH CHECK (false);
