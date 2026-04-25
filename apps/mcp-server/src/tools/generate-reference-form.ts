/**
 * suguvisa_reference_form_generate — 参考様式テンプレートエンジン
 *
 * 入管提出に必要な参考様式（1-2, 1-4, 1-5, 1-6, 1-7, 1-11, 1-16, 1-17, 5-7, 農業-1, 農業-2）
 * にユーザーデータを自動マッピングし、記入済みデータを生成する。
 *
 * ユーザーは「あとはオンライン申請でアップロードするだけ」の状態にできる。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";
import { resolveNationalityCode, resolveIndustryFieldCode, splitRomajiName } from "../data/csv-schema.js";

const require = createRequire(import.meta.url);
const referenceForms = require("../data/reference-forms.json");

// ──────────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────────

interface FormFieldResult {
  id: string;
  label: string;
  value: string | null;
  filled: boolean;
  required: boolean;
  source: "applicant" | "company" | "auto" | "missing";
}

interface GeneratedFormResult {
  form_number: string;
  form_name: string;
  category: string;
  bilingual: boolean;
  bilingual_languages?: string[];
  who: string;
  total_fields: number;
  filled_fields: number;
  completion_rate: number;
  fields: FormFieldResult[];
  missing_fields: string[];
  notes: string;
}

// ──────────────────────────────────────────────────
// フィールド自動マッピング
// ──────────────────────────────────────────────────

/**
 * reference-forms.json のフィールドID → ユーザーデータのキーマッピング
 * 複数のキーにフォールバックする
 */
const FIELD_ALIASES: Record<string, string[]> = {
  // 申請人情報
  applicant_name: ["applicant_name", "name_romaji", "full_name", "name"],
  date_of_birth: ["date_of_birth", "birthday", "dob"],
  nationality: ["nationality", "nationality_code", "country"],
  gender: ["gender", "sex"],
  passport_number: ["passport_number", "passport_no"],

  // 企業情報
  company_name: ["company_name", "organization_name", "employer_name"],
  company_address: ["company_address", "address", "company_location"],
  representative: ["representative", "representative_name", "ceo_name", "daihyo"],
  corporate_number: ["corporate_number", "houjin_bangou"],
  established_date: ["established_date", "founded_date"],
  capital: ["capital", "shihonkin"],
  annual_revenue: ["annual_revenue", "revenue", "uriage"],
  total_employees: ["total_employees", "employee_count"],
  foreign_employees_count: ["foreign_employees_count", "foreign_workers"],
  ssw1_current_count: ["ssw1_current_count", "current_ssw1"],
  ssw1_planned_count: ["ssw1_planned_count", "planned_ssw1"],
  business_description: ["business_description", "business_type", "jigyou_naiyo"],

  // 雇用条件
  job_description: ["job_description", "work_description", "gyoumu"],
  work_location: ["work_location", "workplace", "kinmuchi"],
  contract_period_start: ["contract_period_start", "contract_start_date", "start_date"],
  contract_period_end: ["contract_period_end", "contract_end_date", "end_date"],
  working_hours: ["working_hours", "kinmu_jikan"],
  working_hours_start: ["working_hours_start", "work_start"],
  working_hours_end: ["working_hours_end", "work_end"],
  break_time: ["break_time", "kyukei"],
  rest_days: ["rest_days", "kyujitsu"],
  rest_days_per_week: ["rest_days_per_week", "weekly_off"],
  annual_leave: ["annual_leave", "yukyu"],
  leave: ["leave", "annual_leave", "yukyu"],
  monthly_salary: ["monthly_salary", "salary", "kyuyo"],
  hourly_wage: ["hourly_wage", "jikyuu"],
  overtime_rate: ["overtime_rate", "overtime_rate_normal"],
  overtime_rate_normal: ["overtime_rate_normal", "overtime_rate"],
  overtime_rate_holiday: ["overtime_rate_holiday"],
  overtime_rate_midnight: ["overtime_rate_midnight"],
  bonus: ["bonus", "shoyo"],
  retirement_allowance: ["retirement_allowance", "taishokukin"],

  // 社会保険
  social_insurance: ["social_insurance"],
  social_insurance_health: ["social_insurance_health", "health_insurance"],
  social_insurance_pension: ["social_insurance_pension", "pension"],
  employment_insurance: ["employment_insurance", "koyou_hoken"],
  tax_deductions: ["tax_deductions"],

  // 住居
  housing: ["housing", "jutaku"],
  housing_type: ["housing_type"],
  housing_address: ["housing_address"],
  housing_cost: ["housing_cost", "yachin"],

  // 報酬説明
  comparison_japanese_worker: ["comparison_japanese_worker", "japanese_comparison"],
  deductions: ["deductions", "koujo"],

  // 雇用経緯
  recruitment_method: ["recruitment_method", "boshu_houhou"],
  recruitment_agency: ["recruitment_agency", "shoukai_kikan"],
  introduction_fee: ["introduction_fee", "shoukai_ryo"],
  who_paid_fee: ["who_paid_fee"],
  broker_involvement: ["broker_involvement", "broker"],

  // 支援関係
  support_responsible_person: ["support_responsible_person", "support_person"],
  support_contact: ["support_contact"],
  pre_entry_guidance: ["pre_entry_guidance"],
  pickup_service: ["pickup_service"],
  housing_support: ["housing_support"],
  life_orientation: ["life_orientation"],
  japanese_learning_support: ["japanese_learning_support"],
  consultation_support: ["consultation_support"],
  community_exchange: ["community_exchange"],
  job_change_support: ["job_change_support"],
  periodic_interview: ["periodic_interview"],

  // 事前ガイダンス
  guidance_date: ["guidance_date"],
  guidance_method: ["guidance_method"],
  interpreter_name: ["interpreter_name", "tsuyaku"],
  items_explained: ["items_explained"],

  // 届出関係
  reporting_period: ["reporting_period"],
  ssw1_count: ["ssw1_count"],
  ssw1_names: ["ssw1_names"],
  working_conditions_changes: ["working_conditions_changes"],
  support_implementation_status: ["support_implementation_status"],

  // 報酬支払証明
  period_from: ["period_from", "payment_from"],
  period_to: ["period_to", "payment_to"],
  monthly_payments: ["monthly_payments"],
  total_amount: ["total_amount"],
  deductions_detail: ["deductions_detail"],

  // 農業
  farm_name: ["farm_name", "noujou_mei"],
  farm_address: ["farm_address", "noujou_jusho"],
  farm_area_hectares: ["farm_area_hectares", "menseki"],
  crop_types: ["crop_types", "sakumotsu"],
  farming_method: ["farming_method", "nouhou"],
  farming_type: ["farming_type"],
  total_workers: ["total_workers"],
  japanese_workers: ["japanese_workers"],
  foreign_workers: ["foreign_workers", "foreign_employees_count"],

  // 共通
  date: ["date", "application_date", "today"],
  signature: ["signature", "representative"],
  industry_field: ["industry_field", "industry"],
  examination_date: ["examination_date"],
  doctor_name: ["doctor_name"],
  hospital_name: ["hospital_name"],

  // 随時届出
  reason_for_difficulty: ["reason_for_difficulty"],
  occurrence_date: ["occurrence_date"],
  measures_taken: ["measures_taken"],
  change_type: ["change_type"],
  change_date: ["change_date"],
  before_change: ["before_change"],
  after_change: ["after_change"],
};

function resolveFieldValue(
  fieldId: string,
  applicantData: Record<string, string>,
  companyData: Record<string, string>,
  autoData: Record<string, string>
): { value: string | null; source: "applicant" | "company" | "auto" | "missing" } {
  const aliases = FIELD_ALIASES[fieldId] || [fieldId];

  // 1. Auto data first (pre-computed)
  for (const alias of aliases) {
    if (autoData[alias]) return { value: autoData[alias], source: "auto" };
  }

  // 2. Applicant data
  for (const alias of aliases) {
    if (applicantData[alias]) return { value: applicantData[alias], source: "applicant" };
  }

  // 3. Company data
  for (const alias of aliases) {
    if (companyData[alias]) return { value: companyData[alias], source: "company" };
  }

  return { value: null, source: "missing" };
}

// ──────────────────────────────────────────────────
// メインロジック
// ──────────────────────────────────────────────────

function generateReferenceFormData(
  formId: string,
  applicantData: Record<string, string>,
  companyData: Record<string, string>,
  today: string
): GeneratedFormResult | null {
  const formDef = referenceForms.forms[formId];
  if (!formDef) return null;

  // Auto-computed fields
  const autoData: Record<string, string> = {
    date: today,
    application_date: today,
    today: today,
  };

  // Auto-resolve name if full_name provided
  if (applicantData.name_romaji || applicantData.full_name || applicantData.name) {
    const fullName = applicantData.name_romaji || applicantData.full_name || applicantData.name;
    if (fullName && !applicantData.applicant_name) {
      autoData.applicant_name = fullName.toUpperCase();
    }
  }

  // Nationality resolve
  if (applicantData.nationality) {
    autoData.nationality = applicantData.nationality;
    autoData.nationality_code = resolveNationalityCode(applicantData.nationality);
  }

  // Industry field resolve
  if (companyData.industry_field || applicantData.industry_field) {
    const field = companyData.industry_field || applicantData.industry_field;
    autoData.industry_field = field;
    autoData.industry_field_code = resolveIndustryFieldCode(field);
  }

  // Signature = representative by default
  if (companyData.representative) {
    autoData.signature = companyData.representative;
  }

  const fields: FormFieldResult[] = [];
  const missingFields: string[] = [];

  const fieldIds: string[] = formDef.fields || [];

  for (const fieldId of fieldIds) {
    const { value, source } = resolveFieldValue(fieldId, applicantData, companyData, autoData);
    const label = fieldId.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const filled = value !== null && value !== "";

    // Determine if required (heuristic: core fields are required)
    const coreRequired = [
      "company_name", "representative", "company_address",
      "applicant_name", "date", "signature",
      "monthly_salary", "job_description",
    ];
    const required = coreRequired.includes(fieldId);

    if (!filled) {
      missingFields.push(fieldId);
    }

    fields.push({
      id: fieldId,
      label,
      value: value || null,
      filled,
      required,
      source,
    });
  }

  const filledCount = fields.filter(f => f.filled).length;

  return {
    form_number: formDef.number || `参考様式第${formId}号`,
    form_name: formDef.name,
    category: formDef.category || "",
    bilingual: formDef.bilingual || false,
    bilingual_languages: formDef.bilingual_languages || undefined,
    who: formDef.who || "",
    total_fields: fields.length,
    filled_fields: filledCount,
    completion_rate: fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0,
    fields,
    missing_fields: missingFields,
    notes: formDef.notes || "",
  };
}

// ──────────────────────────────────────────────────
// ツール登録
// ──────────────────────────────────────────────────

export function registerGenerateReferenceForm(server: McpServer) {
  server.tool(
    "suguvisa_reference_form_generate",
    "【参考様式テンプレート生成】入管提出に必要な参考様式（雇用契約書1-5、雇用条件書1-6、支援計画書1-17、所属機関概要書1-11、報酬説明書1-4、誓約書1-2等）にユーザーデータを自動マッピングし、記入済みデータを生成。パターンIDを指定すれば必要な全様式を一括生成。個別の様式番号指定も可能。完成度（%）と不足フィールドを可視化。 / Generates pre-filled reference form data for ISA submission. Maps applicant and company data to official form fields with completion tracking.",
    {
      form_ids: z.array(z.string()).optional().describe(
        "生成する参考様式番号の配列（例: ['1-5', '1-6', '1-17']）。省略時はpattern_idに基づいて必要な全様式を自動選択。"
      ),
      pattern_id: z.string().optional().describe(
        "申請パターンID（例: 'CHANGE_SSW1_C'）。指定すると必要な全様式を自動選択。form_ids と併用可。"
      ),
      applicant_data: z.record(z.string()).describe(
        "申請人データ（キー/値ペア）。例: { name_romaji: 'GILANG PERMANA', nationality: 'インドネシア', date_of_birth: '1995-03-15', passport_number: 'C1234567' }"
      ),
      company_data: z.record(z.string()).default({}).describe(
        "所属機関データ（キー/値ペア）。例: { company_name: '株式会社スグクル', representative: '壁晃弘', company_address: '鹿児島県...', corporate_number: '1234567890123' }"
      ),
      industry_field: z.string().optional().describe(
        "産業分野（例: '農業'）。農業分野固有の様式が必要な場合に指定。"
      ),
      support_type: z.enum(["self", "delegated"]).default("delegated").describe(
        "支援形態（self=自社支援, delegated=登録支援機関委託）"
      ),
    },
    { title: "Generate reference form", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ form_ids, pattern_id, applicant_data, company_data, industry_field, support_type }) => {
      const today = new Date().toISOString().slice(0, 10);

      // Determine which forms to generate
      let targetFormIds: string[] = [];

      if (form_ids && form_ids.length > 0) {
        targetFormIds = form_ids;
      }

      // If pattern_id specified, add all required forms for that pattern
      if (pattern_id) {
        // Core forms for all SSW1 applications
        const ssw1CoreForms = ["1-2", "1-4", "1-5", "1-6", "1-11", "1-16"];
        // Support forms
        const supportForms = support_type === "self" ? ["1-17"] : ["1-17"];
        // Guidance form
        const guidanceForms = ["1-7"];

        // Pattern-specific additions
        const renewalForms = pattern_id.startsWith("RENEWAL") ? ["5-7"] : [];

        // Agriculture-specific
        const agricultureForms = (industry_field === "農業" || industry_field === "agriculture")
          ? ["agriculture-1", "agriculture-2"] : [];

        const allForms = [
          ...ssw1CoreForms,
          ...supportForms,
          ...guidanceForms,
          ...renewalForms,
          ...agricultureForms,
        ];

        // Merge without duplicates
        for (const fid of allForms) {
          if (!targetFormIds.includes(fid)) {
            targetFormIds.push(fid);
          }
        }
      }

      // If still empty, generate all core forms
      if (targetFormIds.length === 0) {
        targetFormIds = ["1-2", "1-4", "1-5", "1-6", "1-7", "1-11", "1-16", "1-17"];
      }

      // Inject industry_field into company_data
      if (industry_field) {
        company_data.industry_field = industry_field;
      }

      // Generate all forms
      const results: GeneratedFormResult[] = [];
      const errors: string[] = [];

      for (const formId of targetFormIds) {
        const result = generateReferenceFormData(formId, applicant_data, company_data, today);
        if (result) {
          results.push(result);
        } else {
          errors.push(`様式 ${formId} のテンプレートが見つかりません`);
        }
      }

      // Summary
      const totalFields = results.reduce((s, r) => s + r.total_fields, 0);
      const filledFields = results.reduce((s, r) => s + r.filled_fields, 0);
      const overallRate = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

      const allMissing = results.flatMap(r =>
        r.missing_fields.map(f => `${r.form_number}: ${f}`)
      );

      const bilingualRequired = results.filter(r => r.bilingual).map(r => ({
        form: r.form_number,
        name: r.form_name,
        languages: r.bilingual_languages || [],
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "ok",
            pattern_id: pattern_id || null,
            support_type,
            forms_generated: results.length,
            summary: {
              total_fields: totalFields,
              filled_fields: filledFields,
              overall_completion_rate: `${overallRate}%`,
              missing_field_count: allMissing.length,
            },
            bilingual_required: bilingualRequired.length > 0 ? bilingualRequired : undefined,
            forms: results,
            all_missing_fields: allMissing.length > 0 ? allMissing : undefined,
            errors: errors.length > 0 ? errors : undefined,
            _ai_instructions:
              "📋 以下の形式で結果を表示してください:\n\n" +
              "## 参考様式 生成結果\n" +
              "- 全体の完成率をプログレスバーで表示（▓▓▓▓░░ 67%）\n" +
              "- 各様式ごとに見出しを付けて完成率を表示\n" +
              "- 🟢 100% / 🟡 50-99% / 🔴 0-49% のアイコンで色分け\n\n" +
              "## 不足フィールド\n" +
              "- missing_fields を表形式で一覧表示\n" +
              "- 「以下の情報を追加で教えていただければ、書類の完成度が上がります」と促す\n\n" +
              "## バイリンガル対応\n" +
              "- bilingual_required がある場合、「この書類は申請人の母国語との併記が必要です」と注意喚起\n\n" +
              "## 次のステップ\n" +
              "- 完成率100%なら → suguvisa_online_csv_generate / suguvisa_bulk_xlsm_generate で申請データ生成を提案\n" +
              "- 不足があれば → 不足情報のヒアリングを提案",
            _next_actions: [
              ...(allMissing.length > 0 ? [{
                action: "ask_user",
                reason: "不足フィールドの追加情報をヒアリング",
                missing_count: allMissing.length,
              }] : []),
              {
                tool: "suguvisa_online_csv_generate",
                reason: "申請CSVの生成（オンライン申請用）",
              },
              {
                tool: "suguvisa_paper_form_generate",
                reason: "申請書本体（別記第30号の5等）のデータマッピング",
              },
            ],
          }, null, 2),
        }],
      };
    }
  );
}
