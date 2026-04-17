/**
 * get_ssw2_document_checklist — 特定技能2号 分野別書類チェックリスト
 *
 * 出入国在留管理庁の公式必要書類一覧（令和8年4月改定版）に基づき、
 * ユーザーが選択した分野・雇用形態に応じた書類チェックリストを返す。
 *
 * 各書類に以下の分類を付与:
 * - source: "auto_generate" = SuguVisaが自動生成可能
 * - source: "user_prepare" = ユーザーが取得・用意する書類
 * - skip_condition: 省略可能条件
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ssw2Checklist = require("../data/ssw2-document-checklist.json");

// ──────────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────────

interface ChecklistDoc {
  id: string;
  no: number;
  name: string;
  name_en?: string;
  source: "auto_generate" | "user_prepare";
  form_ref?: string | null;
  issuer?: string | null;
  skip_condition?: string | null;
  description?: string;
  required_info?: string[];
}

interface ChecklistSection {
  title: string;
  docs: ChecklistDoc[];
  auto_count: number;
  user_count: number;
}

// ──────────────────────────────────────────────────
// ロジック
// ──────────────────────────────────────────────────

function getSSW2Checklist(params: {
  industry_field: string;
  employment_type: "direct" | "dispatch_corporate" | "dispatch_individual";
  employer_type: "corporate" | "sole_proprietor";
}) {
  const { industry_field, employment_type, employer_type } = params;

  // Validate field
  const fields = ssw2Checklist.fields as Record<string, { name: string; table: string; has_dispatch: boolean }>;
  const fieldInfo = fields[industry_field];
  if (!fieldInfo) {
    return {
      status: "error",
      message: `分野 '${industry_field}' が見つかりません。`,
      available_fields: Object.entries(fields).map(([k, v]) => ({
        id: k,
        name: v.name,
        has_dispatch: v.has_dispatch,
      })),
    };
  }

  // Validate employment type for non-dispatch fields
  if (employment_type !== "direct" && !fieldInfo.has_dispatch) {
    return {
      status: "error",
      message: `${fieldInfo.name}分野は直接雇用のみです。派遣雇用は農業・漁業のみ認められています。`,
      available_employment_types: ["direct"],
    };
  }

  // Build sections
  const sections: ChecklistSection[] = [];

  // 1. Common documents (第1表)
  const commonDocs = ssw2Checklist.common_documents.docs as ChecklistDoc[];
  sections.push({
    title: ssw2Checklist.common_documents.title,
    docs: commonDocs,
    auto_count: commonDocs.filter(d => d.source === "auto_generate").length,
    user_count: commonDocs.filter(d => d.source === "user_prepare").length,
  });

  // 2. Organization documents (第2表)
  const orgKey = employer_type === "sole_proprietor" ? "sole_proprietor" : "corporate";
  const orgSection = ssw2Checklist.organization_documents[orgKey];
  if (orgSection) {
    const orgDocs = orgSection.docs as ChecklistDoc[];
    sections.push({
      title: orgSection.title,
      docs: orgDocs,
      auto_count: orgDocs.filter((d: ChecklistDoc) => d.source === "auto_generate").length,
      user_count: orgDocs.filter((d: ChecklistDoc) => d.source === "user_prepare").length,
    });
  }

  // 3. Field-specific documents (第3表)
  const fieldDocs = ssw2Checklist.field_specific_documents[industry_field];
  if (fieldDocs) {
    const empTypeDocs = (fieldDocs[employment_type] || fieldDocs.direct || []) as ChecklistDoc[];
    sections.push({
      title: `分野別書類（${fieldInfo.name}・${getLabelForEmpType(employment_type)}）`,
      docs: empTypeDocs,
      auto_count: empTypeDocs.filter((d: ChecklistDoc) => d.source === "auto_generate").length,
      user_count: empTypeDocs.filter((d: ChecklistDoc) => d.source === "user_prepare").length,
    });
  }

  // Totals
  const allDocs = sections.flatMap(s => s.docs);
  const totalDocuments = allDocs.length;
  const autoGenCount = allDocs.filter(d => d.source === "auto_generate").length;
  const userPrepCount = allDocs.filter(d => d.source === "user_prepare").length;
  const skippableCount = allDocs.filter(d => d.skip_condition).length;

  // Collect all required fields for auto-gen docs
  const allRequiredFields = new Set<string>();
  allDocs
    .filter(d => d.source === "auto_generate" && d.required_info)
    .forEach(d => d.required_info!.forEach(f => allRequiredFields.add(f)));

  return {
    status: "ok",
    field: {
      id: industry_field,
      name: fieldInfo.name,
      table: fieldInfo.table,
      has_dispatch: fieldInfo.has_dispatch,
    },
    employment_type,
    employment_type_label: getLabelForEmpType(employment_type),
    employer_type,
    summary: {
      total_documents: totalDocuments,
      auto_generate: autoGenCount,
      user_prepare: userPrepCount,
      auto_generate_rate: `${Math.round((autoGenCount / totalDocuments) * 100)}%`,
      skippable: skippableCount,
    },
    all_required_input_fields: Array.from(allRequiredFields).sort(),
    sections,
    checklist_url: "/checklist.html",
    _ai_instructions:
      "📋 以下の形式で書類チェックリストを表示してください：\n\n" +
      "## サマリー\n" +
      "- 書類合計数、自動生成数、ユーザー用意数をカード風に表示\n" +
      `- 「${fieldInfo.name}分野・${getLabelForEmpType(employment_type)}の申請に必要な書類は全${totalDocuments}件です」\n\n` +
      "## セクションごとの表示\n" +
      "各セクション（共通・所属機関・分野別）ごとに:\n" +
      "- 🟢 自動生成 → 書類名の前に🟢を付け、「SuguVisaが自動生成します」と注記\n" +
      "- 🔴 ユーザー用意 → 書類名の前に🔴を付け、取得先（issuer）を明記\n" +
      "- 省略可能な書類は ⚡ アイコンで条件を表示\n\n" +
      "## 次のアクション\n" +
      "- 🟢自動生成書類 → generate_reference_form で一括生成を提案\n" +
      "- 🔴ユーザー用意書類 → 取得先と目安期間をアドバイス\n" +
      "- チェックリストUI → checklist_url のリンクを案内",
    _next_actions: [
      {
        tool: "generate_reference_form",
        reason: `🟢自動生成可能な${autoGenCount}件の参考様式を一括生成`,
      },
      {
        tool: "get_required_documents",
        reason: "SSW1パターンの詳細書類リスト（省略条件含む）を取得",
      },
      {
        tool: "calculate_deadlines",
        reason: "申請期限・提出スケジュールを計算",
      },
    ],
  };
}

function getLabelForEmpType(t: string): string {
  const labels: Record<string, string> = {
    direct: "直接雇用",
    dispatch_corporate: "法人派遣",
    dispatch_individual: "個人事業主派遣",
  };
  return labels[t] || t;
}

// ──────────────────────────────────────────────────
// エクスポート
// ──────────────────────────────────────────────────

export { getSSW2Checklist };

export function registerSSW2DocumentChecklist(server: McpServer) {
  server.tool(
    "get_ssw2_document_checklist",
    "【特定技能2号 書類チェックリスト】分野（11分野対応）と雇用形態を選ぶだけで、入管提出に必要な全書類を一覧化。共通書類（第1表）＋所属機関書類（第2表）＋分野別書類（第3表）をセクション分けで表示。🟢自動生成可能 / 🔴ユーザー用意を色分けし、省略条件・取得先・必要入力情報も付記。チェックリストUIのリンクも提供。 / Returns the complete SSW2 document checklist by field and employment type.",
    {
      industry_field: z.enum([
        "building_cleaning", "manufacturing", "construction",
        "shipbuilding", "auto_maintenance", "aviation",
        "accommodation", "agriculture", "fishery",
        "food_manufacturing", "food_service",
      ]).describe(
        "産業分野（英語キー）。日本語で入力された場合は以下のマッピングで変換:\n" +
        "ビルクリーニング=building_cleaning, 工業製品製造業=manufacturing, 建設=construction,\n" +
        "造船・舶用工業=shipbuilding, 自動車整備=auto_maintenance, 航空=aviation,\n" +
        "宿泊=accommodation, 農業=agriculture, 漁業=fishery,\n" +
        "飲食料品製造業=food_manufacturing, 外食業=food_service"
      ),
      employment_type: z.enum(["direct", "dispatch_corporate", "dispatch_individual"]).default("direct").describe(
        "雇用形態。direct=直接雇用、dispatch_corporate=法人派遣、dispatch_individual=個人事業主派遣。\n" +
        "派遣は農業・漁業のみ認められています。他の分野で指定するとエラーになります。"
      ),
      employer_type: z.enum(["corporate", "sole_proprietor"]).default("corporate").describe(
        "所属機関の形態。corporate=法人、sole_proprietor=個人事業主。\n" +
        "所属機関書類（第2表）の内容が変わります。"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async (params) => {
      const result = getSSW2Checklist(params);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
