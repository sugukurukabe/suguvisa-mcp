import { SUGUVISA_USER_ROLES, type SuguVisaUserRole } from "./user-role-guidance.js";

/**
 * SuguVisa スーパーアプリの基盤設計。
 * Foundation blueprint for the SuguVisa super app.
 * Rancangan dasar untuk super app SuguVisa.
 */
export type CalendarDeadlineType =
  | "visa_expiry"
  | "renewal_open"
  | "dispatch_change_14day"
  | "periodic_report"
  | "quarterly_support_meeting"
  | "document_collection"
  | "expert_review";

export type WorkspaceConnectionType =
  | "google_calendar_official_mcp"
  | "google_calendar_api"
  | "gmail_api"
  | "drive_api"
  | "google_meet";

export type IntakeSource = "gmail_attachment" | "drive_file" | "manual_upload" | "calendar_note";

export type ReviewSeverity = "low" | "medium" | "high" | "critical";

export interface CalendarSyncTarget {
  id: CalendarDeadlineType;
  labelJa: string;
  sourceTable: "case_deadlines" | "visa_cases" | "assignments" | "support_records";
  sourceField: string;
  defaultReminderDays: number[];
  eventSummaryTemplate: string;
  duplicateKeyFields: string[];
  requiredScopes: string[];
  writePolicy: "one_way_from_suguvisa" | "human_confirmed_update";
}

export interface WorkspaceMcpDecision {
  type: WorkspaceConnectionType;
  adoptForMvp: boolean;
  reasonJa: string;
  requiredScopes: string[];
  safetyBoundary: string;
}

export interface RoleHomeSection {
  role: SuguVisaUserRole;
  headlineJa: string;
  primaryWidgets: string[];
  nextBestActions: string[];
  hiddenByDefault: string[];
}

export interface IntakePipelineStep {
  id: string;
  source: IntakeSource;
  trigger: string;
  action: string;
  registryEffect: string;
  humanReviewRequired: boolean;
}

export interface ExpertReviewTrigger {
  id: string;
  severity: ReviewSeverity;
  condition: string;
  routeTo: "admin_staff" | "immigration_lawyer" | "lawyer" | "manager";
  requiredEvidence: string[];
}

export interface AnalyticsKpi {
  id: string;
  labelJa: string;
  sourceTables: string[];
  grain: "daily" | "weekly" | "monthly" | "case";
  targetDirection: "increase" | "decrease" | "zero";
}

export interface CaseConciergeDesign {
  inputSignals: string[];
  outputCards: string[];
  nextActionPolicy: string;
  safetyPolicy: string;
}

export interface SuperAppBlueprint {
  calendarSyncTargets: CalendarSyncTarget[];
  workspaceMcpDecisions: WorkspaceMcpDecision[];
  roleHomeSections: RoleHomeSection[];
  caseConcierge: CaseConciergeDesign;
  intakePipeline: IntakePipelineStep[];
  expertReviewTriggers: ExpertReviewTrigger[];
  analyticsKpis: AnalyticsKpi[];
}

const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.events.freebusy";
const CALENDAR_LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";

export const SUGUVISA_SUPER_APP_BLUEPRINT: SuperAppBlueprint = {
  calendarSyncTargets: [
    {
      id: "visa_expiry",
      labelJa: "在留期限",
      sourceTable: "visa_cases",
      sourceField: "visa_expiry",
      defaultReminderDays: [90, 60, 30, 14, 3, 1],
      eventSummaryTemplate: "【SuguVisa】在留期限: {staff_name}",
      duplicateKeyFields: ["tenant_id", "case_id", "deadline_type"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "one_way_from_suguvisa",
    },
    {
      id: "renewal_open",
      labelJa: "更新申請開始可能日",
      sourceTable: "case_deadlines",
      sourceField: "deadline_date",
      defaultReminderDays: [7, 1],
      eventSummaryTemplate: "【SuguVisa】更新準備開始: {staff_name}",
      duplicateKeyFields: ["tenant_id", "case_id", "deadline_type"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "one_way_from_suguvisa",
    },
    {
      id: "dispatch_change_14day",
      labelJa: "派遣先変更・随時届出14日期限",
      sourceTable: "case_deadlines",
      sourceField: "deadline_date",
      defaultReminderDays: [7, 3, 1],
      eventSummaryTemplate: "【SuguVisa 緊急】14日届出期限: {staff_name}",
      duplicateKeyFields: ["tenant_id", "case_id", "deadline_type", "assignment_id"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "one_way_from_suguvisa",
    },
    {
      id: "periodic_report",
      labelJa: "定期届出提出期間",
      sourceTable: "case_deadlines",
      sourceField: "deadline_date",
      defaultReminderDays: [30, 14, 7, 1],
      eventSummaryTemplate: "【SuguVisa】定期届出: {organization_name}",
      duplicateKeyFields: ["tenant_id", "deadline_type", "fiscal_year"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "one_way_from_suguvisa",
    },
    {
      id: "quarterly_support_meeting",
      labelJa: "定期面談",
      sourceTable: "support_records",
      sourceField: "scheduled_at",
      defaultReminderDays: [14, 3, 1],
      eventSummaryTemplate: "【SuguVisa】定期面談: {staff_name}",
      duplicateKeyFields: ["tenant_id", "staff_id", "support_period"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_FREEBUSY_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "human_confirmed_update",
    },
    {
      id: "document_collection",
      labelJa: "書類回収期限",
      sourceTable: "case_deadlines",
      sourceField: "deadline_date",
      defaultReminderDays: [7, 3, 1],
      eventSummaryTemplate: "【SuguVisa】書類回収期限: {missing_party}",
      duplicateKeyFields: ["tenant_id", "case_id", "document_key", "missing_party"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "one_way_from_suguvisa",
    },
    {
      id: "expert_review",
      labelJa: "専門家レビュー期限",
      sourceTable: "case_deadlines",
      sourceField: "deadline_date",
      defaultReminderDays: [3, 1],
      eventSummaryTemplate: "【SuguVisa REVIEW】専門家確認: {case_label}",
      duplicateKeyFields: ["tenant_id", "case_id", "review_queue_id"],
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_FREEBUSY_SCOPE, CALENDAR_LIST_SCOPE],
      writePolicy: "human_confirmed_update",
    },
  ],
  workspaceMcpDecisions: [
    {
      type: "google_calendar_official_mcp",
      adoptForMvp: true,
      reasonJa: "AIエージェントがユーザー権限で予定確認・空き時間提案・イベント作成を行えるため、MVPの中核にする。",
      requiredScopes: [CALENDAR_LIST_SCOPE, CALENDAR_FREEBUSY_SCOPE, CALENDAR_READONLY_SCOPE],
      safetyBoundary: "予定の作成・更新は SuguVisa 内の期限データと人間確認済みアクションに限定する。",
    },
    {
      type: "google_calendar_api",
      adoptForMvp: true,
      reasonJa: "重複防止 eventId、Meet生成、通知設定をサーバー側で安定運用するために直接APIも使う。",
      requiredScopes: [CALENDAR_WRITE_SCOPE, CALENDAR_FREEBUSY_SCOPE, CALENDAR_LIST_SCOPE],
      safetyBoundary: "SuguVisa 管理カレンダーへの一方向同期を初期状態にする。",
    },
    {
      type: "gmail_api",
      adoptForMvp: false,
      reasonJa: "価値は高いが権限が強いため、初期はメール下書き・検索・添付取込の明示同意付きフェーズに分ける。",
      requiredScopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
      ],
      safetyBoundary: "自動送信は禁止し、下書き作成とユーザー確認後送信に限定する。",
    },
    {
      type: "drive_api",
      adoptForMvp: true,
      reasonJa: "派遣先保管書類・本人書類・参考様式の所在管理と GCS 原本台帳連携に直結する。",
      requiredScopes: ["https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/drive.file"],
      safetyBoundary: "ユーザーが選択したファイルまたは SuguVisa が作成したフォルダだけを対象にする。",
    },
    {
      type: "google_meet",
      adoptForMvp: true,
      reasonJa: "事前ガイダンス・定期面談・専門家レビューの予約に Meet URL を自動付与できる。",
      requiredScopes: [CALENDAR_WRITE_SCOPE],
      safetyBoundary: "面談イベント作成時だけ conferenceData を生成する。",
    },
  ],
  roleHomeSections: SUGUVISA_USER_ROLES.map((role) => buildRoleHomeSection(role)),
  caseConcierge: {
    inputSignals: [
      "visa_cases.step",
      "case_deadlines.deadline_date",
      "gcs_object_registry.linked_sql_id",
      "calendar_sync_links.status",
      "document_intake_events.intake_status",
      "expert_review_queue.status",
      "legal_search.grounding_level",
      "user_role",
    ],
    outputCards: [
      "today_next_action",
      "missing_documents_by_party",
      "deadline_risk",
      "calendar_booking_suggestion",
      "draft_message",
      "grounded_legal_warning",
      "expert_review_needed",
    ],
    nextActionPolicy:
      "期限リスク、未回収書類、専門家レビュー、カレンダー予約、メール下書きの順に優先度を付ける。",
    safetyPolicy:
      "primary_source の根拠がない法令判断、就労可否、派遣適法性は断定せず review_queue へ送る。",
  },
  intakePipeline: [
    {
      id: "gmail_attachment_to_case",
      source: "gmail_attachment",
      trigger: "入管・派遣先・本人・専門家からの添付メールをユーザーが取込指定",
      action: "添付をGCSへ保存し、OCR/分類後に visa_cases と gcs_object_registry へリンクする",
      registryEffect: "source_system=gmail, lifecycle=active, domain=visa, is_canonical_original=true",
      humanReviewRequired: true,
    },
    {
      id: "drive_file_to_registry",
      source: "drive_file",
      trigger: "ユーザーが Drive Picker または Drive MCP で書類を選択",
      action: "Drive metadata を保持し、必要に応じてGCSへ正本コピーを作成する",
      registryEffect: "source_system=drive, linked_sql_table=visa_cases, retention_class=case_file",
      humanReviewRequired: false,
    },
    {
      id: "mobile_upload_ocr",
      source: "manual_upload",
      trigger: "スマホから在留カード・パスポート・証明書をアップロード",
      action: "Document AI OCR 後、raw image の保存可否を分類し、保存禁止画像は構造化データのみ残す",
      registryEffect: "raw PII image is not persisted unless explicitly classified as canonical case evidence",
      humanReviewRequired: true,
    },
    {
      id: "meeting_note_to_support_record",
      source: "calendar_note",
      trigger: "定期面談・事前ガイダンスのイベント完了",
      action: "面談メモを要約・翻訳し、義務的支援10項目と支援記録へ紐付ける",
      registryEffect: "source_system=calendar, domain=visa, entity_type=support_record",
      humanReviewRequired: true,
    },
  ],
  expertReviewTriggers: [
    {
      id: "ungrounded_legal_answer",
      severity: "high",
      condition: "grounding_level が primary_source ではない状態で最新法令・就労可否・必要書類判断が必要",
      routeTo: "immigration_lawyer",
      requiredEvidence: ["Vertex AI Search result", "official source URL", "question and draft answer"],
    },
    {
      id: "work_permission_risk",
      severity: "critical",
      condition: "申請中就労、期限超過、特例期間、転職先就労可否に関する判断",
      routeTo: "lawyer",
      requiredEvidence: ["current visa", "visa expiry", "application receipt status", "employment timeline"],
    },
    {
      id: "online_submission_same_day",
      severity: "critical",
      condition: "オンライン申請を在留期限当日に行おうとしている、または既に期限が切れている",
      routeTo: "immigration_lawyer",
      requiredEvidence: ["visa expiry", "current date", "submission mode", "application draft status"],
    },
    {
      id: "illegal_work_or_mismatched_duties",
      severity: "critical",
      condition: "不法就労を示唆する相談、実際の業務内容が申請内容と違う相談、虚偽申請につながる相談",
      routeTo: "lawyer",
      requiredEvidence: ["job description", "actual duties", "employment contract", "user statement"],
    },
    {
      id: "student_attendance_low",
      severity: "high",
      condition: "留学からの変更で出席率80%未満、または欠席理由・中退理由が不明確",
      routeTo: "immigration_lawyer",
      requiredEvidence: ["attendance record", "transcript", "graduation or withdrawal certificate", "reason letter"],
    },
    {
      id: "dispatch_legality_risk",
      severity: "critical",
      condition: "派遣形態が認められる分野・派遣元/派遣先責任範囲・14日届出に関する判断",
      routeTo: "immigration_lawyer",
      requiredEvidence: ["industry field", "dispatch contract", "assignment dates", "client site data"],
    },
    {
      id: "deadline_overdue",
      severity: "high",
      condition: "case_deadlines が期限超過、または14日届出の残日数が1日以下",
      routeTo: "manager",
      requiredEvidence: ["deadline record", "case status", "last notification log"],
    },
    {
      id: "missing_canonical_evidence",
      severity: "medium",
      condition: "提出前チェックで必須書類の gcs_object_registry 正本リンクが無い",
      routeTo: "admin_staff",
      requiredEvidence: ["required document list", "registry search result", "case checklist"],
    },
  ],
  analyticsKpis: [
    {
      id: "deadline_overdue_count",
      labelJa: "期限超過件数",
      sourceTables: ["case_deadlines", "visa_cases"],
      grain: "daily",
      targetDirection: "zero",
    },
    {
      id: "dispatch_14day_miss_rate",
      labelJa: "派遣先変更14日届出遅延率",
      sourceTables: ["case_deadlines", "assignments", "visa_audit_logs"],
      grain: "monthly",
      targetDirection: "zero",
    },
    {
      id: "document_collection_lead_time",
      labelJa: "書類回収リードタイム",
      sourceTables: ["gcs_object_registry", "visa_cases"],
      grain: "case",
      targetDirection: "decrease",
    },
    {
      id: "revision_required_rate",
      labelJa: "補正率",
      sourceTables: ["submission_outcomes"],
      grain: "monthly",
      targetDirection: "decrease",
    },
    {
      id: "grounded_answer_rate",
      labelJa: "一次情報根拠付き回答率",
      sourceTables: ["visa_audit_logs", "tool_execution_log"],
      grain: "weekly",
      targetDirection: "increase",
    },
    {
      id: "support_meeting_completion_rate",
      labelJa: "定期面談実施率",
      sourceTables: ["support_records", "case_deadlines"],
      grain: "monthly",
      targetDirection: "increase",
    },
  ],
};

function buildRoleHomeSection(role: SuguVisaUserRole): RoleHomeSection {
  const commonHidden = ["raw_pii", "cross_tenant_data", "unverified_legal_assertions"];

  switch (role) {
    case "foreign_worker":
      return {
        role,
        headlineJa: "あなたが今することをやさしく案内",
        primaryWidgets: ["my_deadlines", "documents_to_prepare", "booking_page", "multilingual_messages"],
        nextBestActions: ["就労できる範囲確認", "在留カード確認", "パスポート確認", "費用と郵送物確認", "会社へ依頼する書類確認", "面談予約"],
        hiddenByDefault: [...commonHidden, "company_finance", "expert_internal_notes"],
      };
    case "dispatching_organization_staff":
      return {
        role,
        headlineJa: "派遣元の期限・派遣固有書類・14日届出を一画面で管理",
        primaryWidgets: ["deadline_cockpit", "dispatch_document_gap", "client_collection_status", "review_queue"],
        nextBestActions: ["派遣先契約書回収", "就業条件明示書と押印確認", "派遣計画書確認", "14日届出登録", "契約満了日確認", "専門家レビュー依頼"],
        hiddenByDefault: commonHidden,
      };
    case "dispatch_client_contact":
      return {
        role,
        headlineJa: "派遣先が出す資料だけを迷わず提出",
        primaryWidgets: ["requested_documents", "site_information_form", "booking_page", "message_threads"],
        nextBestActions: ["派遣先概要書入力", "責任者情報確認", "就業条件明示書確認", "押印書類提出", "安全衛生情報提出"],
        hiddenByDefault: [...commonHidden, "applicant_private_data", "dispatching_company_internal_tasks"],
      };
    case "immigration_lawyer":
    case "lawyer":
      return {
        role,
        headlineJa: "根拠・未確認点・補正リスクを専門家レビュー用に集約",
        primaryWidgets: ["grounding_sources", "review_queue", "case_timeline", "evidence_binder"],
        nextBestActions: ["一次情報確認", "補正リスク確認", "提出前レビュー", "意見メモ作成"],
        hiddenByDefault: commonHidden,
      };
    case "support_organization_staff":
      return {
        role,
        headlineJa: "支援計画・定期面談・届出漏れを防止",
        primaryWidgets: ["support_meeting_calendar", "periodic_report_status", "support_record_gap", "deadline_cockpit"],
        nextBestActions: ["定期面談予約", "支援記録確認", "定期届出準備", "14日届出確認"],
        hiddenByDefault: commonHidden,
      };
    case "accepting_organization":
      return {
        role,
        headlineJa: "会社側の準備物・契約条件・届出義務を整理",
        primaryWidgets: ["company_documents", "employment_terms_check", "deadline_cockpit", "evidence_binder"],
        nextBestActions: ["法人番号確認", "雇用契約確認", "協議会加入確認", "社保税証明回収"],
        hiddenByDefault: commonHidden,
      };
    case "admin_staff":
      return {
        role,
        headlineJa: "不足情報と今日の作業をチェックリスト化",
        primaryWidgets: ["today_tasks", "missing_fields", "document_collection", "calendar_reminders"],
        nextBestActions: ["未回収書類へ催促", "OCR結果確認", "期限登録", "提出前チェック"],
        hiddenByDefault: commonHidden,
      };
    case "unknown":
      return {
        role,
        headlineJa: "立場確認から安全に開始",
        primaryWidgets: ["role_selector", "general_guide", "safe_questions"],
        nextBestActions: ["立場を選択", "申請段階を入力", "雇用形態を確認"],
        hiddenByDefault: [...commonHidden, "high_risk_actions"],
      };
  }
}

export function getCalendarSyncTarget(id: CalendarDeadlineType): CalendarSyncTarget {
  const target = SUGUVISA_SUPER_APP_BLUEPRINT.calendarSyncTargets.find((item) => item.id === id);
  if (!target) {
    throw new Error(`Unknown calendar deadline type: ${id}`);
  }
  return target;
}

export function getRoleHomeSection(role: SuguVisaUserRole): RoleHomeSection {
  const section = SUGUVISA_SUPER_APP_BLUEPRINT.roleHomeSections.find((item) => item.role === role);
  if (!section) {
    throw new Error(`Unknown role home section: ${role}`);
  }
  return section;
}

export function listMvpWorkspaceConnections(): WorkspaceMcpDecision[] {
  return SUGUVISA_SUPER_APP_BLUEPRINT.workspaceMcpDecisions.filter((decision) => decision.adoptForMvp);
}

