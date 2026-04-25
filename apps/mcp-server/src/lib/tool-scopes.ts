/**
 * ツールごとのスコープマッピング
 * Scope mapping per tool
 * Pemetaan scope per alat
 */

import type { Scope } from '@suguvisa/auth';

export const TOOL_SCOPE_MAP: Record<string, Scope[]> = {
  suguvisa_application_type_determine: ['read:visa_case'],
  suguvisa_required_documents_list: ['read:visa_case'],
  suguvisa_application_data_validate: ['validate:application_data'],
  suguvisa_form_ai_validate: ['validate:application_data'],
  suguvisa_document_extract_advanced: ['read:visa_case'],
  suguvisa_deadlines_calculate: ['read:visa_case'],

  suguvisa_intake_sheet_generate: ['read:visa_case'],
  suguvisa_residence_card_parse: ['read:visa_case'],
  suguvisa_passport_parse: ['read:visa_case'],
  suguvisa_corporate_number_lookup: ['read:visa_case'],

  suguvisa_online_csv_generate: ['generate:annual_report'],
  suguvisa_bulk_xlsm_generate: ['generate:bulk_xlsm'],
  suguvisa_paper_form_generate: ['generate:paper_form'],
  suguvisa_annual_report_csv_generate: ['generate:annual_report'],
  suguvisa_annual_report_offline_generate: ['generate:annual_report'],
  suguvisa_reference_form_generate: ['generate:paper_form'],
  suguvisa_reason_letter_generate: ['generate:reason_letter'],

  suguvisa_autonomous_workflow_start: ['read:visa_case'],
  suguvisa_autonomous_workflow_resume: ['read:visa_case'],

  suguvisa_submission_outcome_track: ['write:submission_outcome'],
  suguvisa_audit_action_log: ['write:audit_log'],
  suguvisa_audit_logs_list: ['read:visa_case'],

  suguvisa_law_updates_list: ['read:law_updates'],
  suguvisa_legal_docs_search: ['read:law_updates'],
  suguvisa_golden_records_search: ['read:golden_records'],
  suguvisa_vertex_datastore_sync: ['admin:tenant'],
  suguvisa_document_review: ['review:document'],

  suguvisa_visa_guide_get: ['read:visa_case'],
  suguvisa_ssw2_checklist_get: ['read:visa_case'],
  suguvisa_submission_checklist_verify: ['validate:application_data'],

  suguvisa_workplace_message_translate: ['read:visa_case'],
  suguvisa_staff_visa_register: ['write:audit_log'],
  suguvisa_staff_visa_status_check: ['read:visa_case'],
  suguvisa_staff_notification_deadline_check: ['read:visa_case'],
  suguvisa_staff_compliance_dashboard_get: ['read:visa_case'],
  suguvisa_wage_compliance_check: ['validate:application_data'],
  suguvisa_periodic_notification_requirements_check: ['read:visa_case'],
  suguvisa_support_records_analyze: ['review:document'],
  suguvisa_periodic_notification_forms_generate: ['generate:annual_report'],
};

/**
 * ツール名から必要なスコープを取得
 * Get required scopes for a tool name
 * Dapatkan scope yang diperlukan untuk nama alat
 */
export function getToolScopes(toolName: string): Scope[] {
  return TOOL_SCOPE_MAP[toolName] ?? [];
}
