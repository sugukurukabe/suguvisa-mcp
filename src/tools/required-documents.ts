import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");
const referenceForms = require("../data/reference-forms.json");
const fieldSpecific = require("../data/field-specific.json");

interface RefFormDef {
  number?: string;
  fields?: unknown[];
  bilingual_languages?: string[];
}

function getRefFormInfo(templateStr: string): RefFormDef | null {
  // "参考様式第1-5号" → referenceForms.forms["1-5"]
  const match = templateStr?.match(/第?(\d+-\d+)号/);
  if (!match) return null;
  const key = match[1];
  return referenceForms.forms[key] || null;
}

interface CommonDoc {
  name: string;
  template?: string;
  who?: string;
  bilingual?: boolean;
  skippable_if_2year?: boolean;
}

interface DocumentEntry {
  name: string;
  category: string;
  template?: string;
  who?: string;
  bilingual?: boolean;
  reference_form_detail?: {
    number?: string;
    fields_count?: number;
    bilingual_languages?: string[];
  } | null;
  skipped?: boolean;
  skip_reason?: string;
  reference_form_number?: string;
}

export function getRequiredDocumentsData(params: {
  pattern_id: string;
  support_type?: "self" | "delegated";
  is_same_employer_2year?: boolean;
  is_domestic?: boolean;
  industry_field?: string;
  employer_type?: "corporate" | "individual";
}) {
  const { pattern_id, support_type = "delegated", is_same_employer_2year = false, is_domestic = true, industry_field, employer_type = "corporate" } = params;
  const pattern = ruleSets.application_patterns[pattern_id];
      if (!pattern) {
        return {
          status: "error",
          message: `パターンID '${pattern_id}' が見つかりません / Pattern ID not found / ID pola tidak ditemukan`,
          available: Object.keys(ruleSets.application_patterns),
        };
      }
      const documents: DocumentEntry[] = [];
      const is_ssw2 = pattern.to_visa === "特定技能2号" || pattern.to_visa === "特定活動（特定技能準備）";

      // 1. 共通書類（全申請） / Common Docs
      const commonDocsKey = is_ssw2 && pattern.to_visa === "特定技能2号" ? "all_ssw2_applications" : "all_ssw1_applications";
      for (const doc of ruleSets.common_documents[commonDocsKey as keyof typeof ruleSets.common_documents] as CommonDoc[]) {
        const refInfo = doc.template ? getRefFormInfo(doc.template) : null;
        documents.push({
          name: doc.name,
          template: doc.template,
          who: doc.who,
          category: "共通書類 / Common Docs",
          bilingual: doc.bilingual || false,
          reference_form_detail: refInfo ? {
            number: refInfo.number,
            fields_count: refInfo.fields?.length || 0,
            bilingual_languages: refInfo.bilingual_languages || [],
          } : null,
        });
      }

      // 2. 支援関連書類 / Support Docs
      const supportDocs = (support_type === "self"
        ? ruleSets.common_documents.support_self
        : ruleSets.common_documents.support_delegated) as CommonDoc[];
      for (const doc of supportDocs) {
        const refInfo = doc.template ? getRefFormInfo(doc.template) : null;
        documents.push({
          name: doc.name,
          template: doc.template,
          who: doc.who,
          category: "支援関連 / Support Docs",
          reference_form_detail: refInfo ? {
            number: refInfo.number,
            fields_count: refInfo.fields?.length || 0,
          } : null,
        });
      }

      // 3. 所属機関証明書類 / Company Certs
      for (const doc of ruleSets.common_documents.company_certificates as (CommonDoc & { employer_types?: string[] })[]) {
        if (doc.employer_types && doc.employer_types.length > 0) {
          if (!doc.employer_types.includes(employer_type) && !doc.employer_types.includes("individual_applicable")) {
            continue; // Skip document if it doesn't apply to the current employer_type
          }
        }
        
        const skipped = !!(is_same_employer_2year && doc.skippable_if_2year);
        documents.push({
          name: doc.name,
          template: doc.template,
          who: doc.who,
          category: "所属機関証明 / Company Certificates",
          skipped,
          skip_reason: skipped ? "2年以内に同一所属機関から申請済み / Same employer within 2 yrs" : undefined,
        });
      }

      // 4. 申請人共通書類 / Applicant Common Docs
      for (const doc of ruleSets.common_documents.applicant_common as CommonDoc[]) {
        documents.push({ 
          name: doc.name,
          template: doc.template,
          who: doc.who,
          category: "申請人共通 / Applicant Common" 
        });
      }

      // 5. 国内申請のみ / Domestic Only
      if (is_domestic) {
        for (const doc of ruleSets.common_documents.applicant_domestic_only as CommonDoc[]) {
          documents.push({ 
            name: doc.name,
            template: doc.template,
            who: doc.who,
            category: "申請人（国内のみ） / Applicant (Domestic Only)" 
          });
        }
      }

      // 6. パターン固有書類 / Pattern Specific Docs
      if (Array.isArray(pattern.special_documents)) {
        for (const name of pattern.special_documents) {
          documents.push({ name: String(name), category: "パターン固有 / Pattern Specific", who: "—" });
        }
      }

      // 7. 分野固有書類 / Field Specific Docs
      const fieldDocs: DocumentEntry[] = [];
      if (industry_field && fieldSpecific.fields[industry_field]) {
        const fieldInfo = fieldSpecific.fields[industry_field];
        
        const targetDocsArray = (is_ssw2 && fieldInfo.additional_documents_ssw2) 
            ? fieldInfo.additional_documents_ssw2 
            : fieldInfo.additional_documents;

        if (Array.isArray(targetDocsArray)) {
          for (const doc of targetDocsArray) {
            const docEntry: DocumentEntry = {
              name: String(doc.name),
              category: `分野固有（${industry_field}） / Field Specific`,
              who: doc.who ? String(doc.who) : "所属機関 / Company",
            };
            if (doc.reference_form) {
              const refInfo = referenceForms.forms[doc.reference_form];
              if (refInfo) {
                docEntry.reference_form_number = String(refInfo.number);
              }
            }
            fieldDocs.push(docEntry);
            documents.push(docEntry);
          }
        }
      }

      // 試験免除情報 / Exam Exemption
      const examInfo: Record<string, unknown> = {};
      if (pattern.exam_exemption) {
        examInfo.skill_test = pattern.exam_exemption.skill_test;
        examInfo.japanese_test = pattern.exam_exemption.japanese_test;
        examInfo.note = pattern.exam_exemption.note;

        // 分野の試験情報を追加 / Add field exam details
        if (industry_field && fieldSpecific.fields[industry_field]) {
          const fieldInfo = fieldSpecific.fields[industry_field];
          examInfo.skill_test_detail = fieldInfo.skill_test;
          examInfo.japanese_test_options = fieldInfo.japanese_test?.options || [];
        }
      }

  return {
    status: "ok",
    pattern_id,
    formal_name: pattern.formal_name,
    form_code: pattern.form_code,
    total_documents: documents.length,
    skipped_count: documents.filter((d: DocumentEntry) => d.skipped).length,
    field_specific_count: fieldDocs.length,
    exam_exemption: examInfo,
    documents,
    skip_conditions: pattern.skip_conditions || [],
    download_url: "https://www.moj.go.jp/isa/applications/ssw/nyuukokukanri07_00030.html",
    _ai_instructions:
      "🎯 【エージェントモード：書類リスト取得完了 → 次は作成】\n" +
      "書類リストが出ました。チャットで終わるな。書類を作れ。\n\n" +
      "1. 「📄 必要書類 " + documents.length + "件（うち" + documents.filter((d: DocumentEntry) => d.skipped).length + "件省略可）」と1行で伝える\n" +
      "2. 書類リストを簡潔な表で表示（☐ チェックボックス付き）\n" +
      "3. 即座に以下を実行（ユーザーに聞かずに）：\n" +
      "   - generate_reason_letter(use_ai: true) → 理由書を生成\n" +
      "   - generate_reference_form → テンプレート生成\n" +
      "   - generate_intake_sheet → 入力シート生成\n" +
      "4. 省略条件は簡潔にメモ程度で\n\n" +
      "禁止：「次のステップとして○○を提案します」→ 提案じゃなく実行しろ",
    _next_actions: [
      { tool: "generate_reason_letter", reason: "理由書をAI生成", params: { use_ai: true } },
      { tool: "generate_reference_form", reason: "参考様式テンプレートを生成" },
      { tool: "generate_intake_sheet", reason: "入力シートを生成" },
      { tool: "pre_submission_checklist", reason: "提出前チェック" },
    ],
  };
}

export function registerRequiredDocuments(server: McpServer) {
  server.tool(
    "get_required_documents",
    "【必要書類リスト生成】申請パターンIDに基づき、入管提出に必要な全書類を一覧化。「2年以内の同一機関申請で省略可」「自社支援なら不要」等の省略条件を自動適用し、実際に準備が必要な書類だけを返す。カテゴリ別（申請人・所属機関・分野別）に整理し、各書類の入手方法・注意点も付記。 / Returns categorized document checklist with automatic skip-condition logic for 2-year rule, self-support exemptions, and more.",
    {
      pattern_id: z.string().describe("申請パターンID（例: 'CHANGE_SSW1_C'）。ユーザーからパターンIDの直接指定がない場合は、まずは 'determine_application_type' を使って判定するか、対話で状況を引き出してください。"),
      support_type: z.enum(["self", "delegated"]).default("delegated").describe("支援体制（self=自社支援, delegated=登録支援機関へ委託）。ヒアリング時は『登録支援機関に支援を委託されますか？』と尋ねてください。"),
      is_same_employer_2year: z.boolean().default(false).describe("2年以内に同一機関から申請したか。不明な場合は『御社では過去2年以内に同じ分野の特定技能外国人を採用した実績はありますか？（あれば一部書類が免除されます）』と尋ねてください。"),
      is_domestic: z.boolean().default(true).describe("国内申請か海外からの呼び寄せ（認定）か。"),
      industry_field: z.string().optional().describe("特定産業分野の名前。指定がない場合、『例えば農業や建設など、どの分野で就労されますか？』と具体例を交えてヒアリングしてください。（例: '農業', '飲食料品製造業'）"),
      employer_type: z.enum(["corporate", "individual"]).default("corporate").describe("雇用主の法人形態。不明な場合は『雇用元は株式会社などの「法人」ですか、それとも個人農家などの「個人事業主」ですか？』と確認してください。"),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async (params) => {
      const result = getRequiredDocumentsData(params);
      if ('message' in result) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
