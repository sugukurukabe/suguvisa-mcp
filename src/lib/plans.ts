/**
 * テナント別サブスクリプションプラン定義とアクセス制御
 *
 * Phase 3: SaaS プランによるリクエスト制限・機能ゲート・利用統計
 */

export interface PlanConfig {
  name: string;
  requests_per_minute: number;
  requests_per_day: number;
  allowed_tools: "all" | string[];
  max_bulk_records: number;
  features: {
    ocr: boolean;
    legal_search: boolean;
    bulk_generation: boolean;
    audit_log: boolean;
    annual_report: boolean;
    autonomous_workflow: boolean;
  };
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    name: "Free",
    requests_per_minute: 10,
    requests_per_day: 100,
    allowed_tools: [
      "determine_application_type",
      "get_required_documents",
      "calculate_deadlines",
      "validate_application_data",
      "get_complete_visa_guide",
      "get_law_updates",
    ],
    max_bulk_records: 5,
    features: {
      ocr: false,
      legal_search: false,
      bulk_generation: false,
      audit_log: false,
      annual_report: false,
      autonomous_workflow: false,
    },
  },
  starter: {
    name: "Starter",
    requests_per_minute: 30,
    requests_per_day: 500,
    allowed_tools: "all",
    max_bulk_records: 20,
    features: {
      ocr: true,
      legal_search: false,
      bulk_generation: true,
      audit_log: true,
      annual_report: true,
      autonomous_workflow: false,
    },
  },
  professional: {
    name: "Professional",
    requests_per_minute: 60,
    requests_per_day: 3000,
    allowed_tools: "all",
    max_bulk_records: 100,
    features: {
      ocr: true,
      legal_search: true,
      bulk_generation: true,
      audit_log: true,
      annual_report: true,
      autonomous_workflow: true,
    },
  },
  unlimited: {
    name: "Unlimited",
    requests_per_minute: 300,
    requests_per_day: 99999,
    allowed_tools: "all",
    max_bulk_records: 999,
    features: {
      ocr: true,
      legal_search: true,
      bulk_generation: true,
      audit_log: true,
      annual_report: true,
      autonomous_workflow: true,
    },
  },
};

/**
 * プラン名からコンフィグを取得（フォールバック: free）
 */
export function getPlanConfig(planName?: string): PlanConfig {
  if (!planName) return PLANS.unlimited; // ローカルモードは unlimited
  return PLANS[planName] || PLANS.free;
}

/**
 * ツール名がプランで利用可能かチェック
 */
export function isToolAllowed(planName: string | undefined, toolName: string): boolean {
  const plan = getPlanConfig(planName);
  if (plan.allowed_tools === "all") return true;
  return plan.allowed_tools.includes(toolName);
}
