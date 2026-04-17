/**
 * ツールごとのスコープマッピング
 * Scope mapping per tool
 * Pemetaan scope per alat
 */

import type { Scope } from '@suguvisa/auth';

export const TOOL_SCOPE_MAP: Record<string, Scope[]> = {
  determine_application_type: ['read:visa_case'],
  get_required_documents: ['read:visa_case'],
  validate_application_data: ['validate:application_data'],
  ai_form_validator: ['validate:application_data'],
  advanced_doc_extractor: ['read:visa_case'],
  calculate_deadlines: ['read:visa_case'],

  generate_intake_sheet: ['read:visa_case'],
  parse_residence_card: ['read:visa_case'],
  parse_passport: ['read:visa_case'],
  lookup_corporate_number: ['read:visa_case'],

  generate_online_csv: ['generate:annual_report'],
  generate_bulk_xlsm: ['generate:bulk_xlsm'],
  generate_paper_form: ['generate:paper_form'],
  generate_annual_report_csv: ['generate:annual_report'],
  generate_annual_report_offline: ['generate:annual_report'],
  generate_reference_form: ['generate:paper_form'],
  generate_reason_letter: ['generate:reason_letter'],

  start_autonomous_visa_workflow: ['read:visa_case'],
  resume_autonomous_visa_workflow: ['read:visa_case'],

  track_submission_outcome: ['write:submission_outcome'],
  log_visa_action: ['write:audit_log'],
  get_visa_audit_logs: ['read:visa_case'],

  get_law_updates: ['read:law_updates'],
  search_legal_docs: ['read:law_updates'],
  sync_vertex_datastore: ['admin:tenant'],
  review_document: ['review:document'],

  get_complete_visa_guide: ['read:visa_case'],
  get_ssw2_document_checklist: ['read:visa_case'],
  pre_submission_checklist: ['validate:application_data'],

  translate_workplace_message: ['read:visa_case'],
  register_staff_visa: ['write:audit_log'],
  check_all_visa_status: ['read:visa_case'],
  check_notification_deadline: ['read:visa_case'],
  get_compliance_dashboard: ['read:visa_case'],
  check_wage_compliance: ['validate:application_data'],
  check_periodic_notification_requirements: ['read:visa_case'],
  analyze_support_records_docai: ['review:document'],
  generate_periodic_notification_forms: ['generate:annual_report'],
};

/**
 * ツール名から必要なスコープを取得
 * Get required scopes for a tool name
 * Dapatkan scope yang diperlukan untuk nama alat
 */
export function getToolScopes(toolName: string): Scope[] {
  return TOOL_SCOPE_MAP[toolName] ?? [];
}
