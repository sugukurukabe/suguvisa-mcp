/**
 * テナント別サブスクリプションプラン定義とアクセス制御
 *
 * 正準な定義は `@suguvisa/billing` の `PLAN_DEFINITIONS` にあり、
 * ここではサーバー内で使いやすい形に薄く変換している。
 *
 * Phase 3: SaaS プランによるリクエスト制限・機能ゲート・利用統計
 */
import {
  getPlan as getPlanDefinition,
  type PlanDefinition,
  type PlanKey,
} from "@suguvisa/billing";

export interface PlanConfig {
  name: string;
  requests_per_minute: number;
  requests_per_day: number;
  allowed_tools: "all" | string[];
  max_bulk_records: number;
  features: PlanDefinition["features"];
}

function toConfig(def: PlanDefinition): PlanConfig {
  return {
    name: def.name,
    requests_per_minute: def.requestsPerMinute,
    requests_per_day: def.requestsPerDay,
    allowed_tools: def.allowedTools ?? "all",
    max_bulk_records: def.maxBulkRecords,
    features: def.features,
  };
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  free: toConfig(getPlanDefinition("free")),
  starter: toConfig(getPlanDefinition("starter")),
  professional: toConfig(getPlanDefinition("professional")),
  unlimited: toConfig(getPlanDefinition("unlimited")),
};

/**
 * プラン名からコンフィグを取得（フォールバック: free）
 * ローカルモード (未認証) では unlimited を返す
 */
export function getPlanConfig(planName?: string | null): PlanConfig {
  if (!planName) return PLANS.unlimited;
  const def = getPlanDefinition(planName);
  return toConfig(def);
}

/**
 * ツール名がプランで利用可能かチェック
 */
export function isToolAllowed(planName: string | undefined | null, toolName: string): boolean {
  const plan = getPlanConfig(planName);
  if (plan.allowed_tools === "all") return true;
  return plan.allowed_tools.includes(toolName);
}
