/**
 * プランカタログ / Plan catalog / Katalog paket
 *
 * SuguVisa MCP の課金プランとその機能フラグ・クォータの正準な定義。
 * apps/mcp-server の `lib/plans.ts` はこの定義に一致するよう保たれる。
 *
 * Canonical definition of SuguVisa MCP billing plans, feature flags, and quotas.
 * The plan config in `apps/mcp-server/src/lib/plans.ts` is kept in sync with this.
 */

export type PlanKey = "free" | "starter" | "professional" | "unlimited";

export interface PlanDefinition {
  key: PlanKey;
  /** 日本語表示名 */
  name: string;
  /** 短い説明 (日本語 / 英語) */
  description: { ja: string; en: string };
  /** 月額 (JPY) — 表示用。実際の価格は Stripe の Price が source of truth */
  monthlyPriceJpy: number;
  /** 年額 (JPY) */
  yearlyPriceJpy: number;
  /** 1 分あたりリクエスト上限 */
  requestsPerMinute: number;
  /** 1 日あたりリクエスト上限 */
  requestsPerDay: number;
  /** 一括生成の最大レコード数 */
  maxBulkRecords: number;
  /** 機能フラグ */
  features: {
    ocr: boolean;
    legal_search: boolean;
    bulk_generation: boolean;
    audit_log: boolean;
    annual_report: boolean;
    autonomous_workflow: boolean;
  };
  /** free プランで利用できるツール (undefined = all) */
  allowedTools?: string[];
  /** SaaS として公開するか (unlimited は内部専用) */
  publiclyListed: boolean;
}

const FREE_TOOLS = [
  "determine_application_type",
  "get_required_documents",
  "calculate_deadlines",
  "validate_application_data",
  "get_complete_visa_guide",
  "get_law_updates",
];

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    description: {
      ja: "無料プラン。基本的な申請判定・期限計算・書類リスト取得が試せます。",
      en: "Free plan. Try pattern resolution, deadline calculation, and document lists.",
    },
    monthlyPriceJpy: 0,
    yearlyPriceJpy: 0,
    requestsPerMinute: 10,
    requestsPerDay: 100,
    maxBulkRecords: 5,
    features: {
      ocr: false,
      legal_search: false,
      bulk_generation: false,
      audit_log: false,
      annual_report: false,
      autonomous_workflow: false,
    },
    allowedTools: FREE_TOOLS,
    publiclyListed: true,
  },
  starter: {
    key: "starter",
    name: "Starter",
    description: {
      ja: "個人行政書士向け。OCR・一括生成・監査ログ・年次報告を含む実務プラン。",
      en: "For solo immigration lawyers. Includes OCR, bulk generation, audit log, annual report.",
    },
    monthlyPriceJpy: 19_800,
    yearlyPriceJpy: 198_000,
    requestsPerMinute: 30,
    requestsPerDay: 500,
    maxBulkRecords: 20,
    features: {
      ocr: true,
      legal_search: false,
      bulk_generation: true,
      audit_log: true,
      annual_report: true,
      autonomous_workflow: false,
    },
    publiclyListed: true,
  },
  professional: {
    key: "professional",
    name: "Professional",
    description: {
      ja: "派遣会社・登録支援機関向け。法令検索と自律ワークフローを含む全機能プラン。",
      en: "For staffing agencies and support orgs. Includes legal search and autonomous workflow.",
    },
    monthlyPriceJpy: 49_800,
    yearlyPriceJpy: 498_000,
    requestsPerMinute: 60,
    requestsPerDay: 3_000,
    maxBulkRecords: 100,
    features: {
      ocr: true,
      legal_search: true,
      bulk_generation: true,
      audit_log: true,
      annual_report: true,
      autonomous_workflow: true,
    },
    publiclyListed: true,
  },
  unlimited: {
    key: "unlimited",
    name: "Unlimited (internal)",
    description: {
      ja: "内部運用および契約 Enterprise 向け。請求書払い、個別 SLA に基づく契約。",
      en: "Internal and Enterprise contract tier. Invoice billing and custom SLA.",
    },
    monthlyPriceJpy: 0,
    yearlyPriceJpy: 0,
    requestsPerMinute: 300,
    requestsPerDay: 99_999,
    maxBulkRecords: 999,
    features: {
      ocr: true,
      legal_search: true,
      bulk_generation: true,
      audit_log: true,
      annual_report: true,
      autonomous_workflow: true,
    },
    publiclyListed: false,
  },
};

export function getPlan(key: string | null | undefined): PlanDefinition {
  if (!key) return PLAN_DEFINITIONS.free;
  if (isPlanKey(key)) return PLAN_DEFINITIONS[key];
  return PLAN_DEFINITIONS.free;
}

export function isPlanKey(value: string): value is PlanKey {
  return value === "free" || value === "starter" || value === "professional" || value === "unlimited";
}

export function listPublicPlans(): PlanDefinition[] {
  return Object.values(PLAN_DEFINITIONS).filter((p) => p.publiclyListed);
}

/**
 * Stripe Price ID とプランキーのマッピング
 * Stripe price id → plan key mapping
 *
 * 環境変数:
 *   SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY
 *   SUGUVISA_STRIPE_PRICE_STARTER_YEARLY
 *   SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY
 *   SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY
 */
export interface PriceMapping {
  priceId: string;
  plan: PlanKey;
  interval: "month" | "year";
}

export function buildPriceMappingFromEnv(env: NodeJS.ProcessEnv = process.env): PriceMapping[] {
  const mappings: PriceMapping[] = [];
  const pairs: Array<[string, PlanKey, "month" | "year"]> = [
    ["SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY", "starter", "month"],
    ["SUGUVISA_STRIPE_PRICE_STARTER_YEARLY", "starter", "year"],
    ["SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY", "professional", "month"],
    ["SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY", "professional", "year"],
  ];
  for (const [envKey, plan, interval] of pairs) {
    const priceId = env[envKey];
    if (priceId && priceId.trim().length > 0) {
      mappings.push({ priceId: priceId.trim(), plan, interval });
    }
  }
  return mappings;
}

export function resolvePlanFromPriceId(
  priceId: string,
  mappings: PriceMapping[],
): PlanKey | null {
  const hit = mappings.find((m) => m.priceId === priceId);
  return hit ? hit.plan : null;
}
