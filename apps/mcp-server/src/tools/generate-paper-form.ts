import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");
const formFieldMappings = require("../data/form-field-mappings.json");

interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  format?: string;
  example?: string;
  default?: string;
  unit?: string;
  [key: string]: unknown;
}

interface FormSection {
  section: string;
  page: number;
  fields: FormField[];
  [key: string]: unknown;
}

interface FormDef {
  name: string;
  total_pages: number;
  sections: FormSection[];
  [key: string]: unknown;
}

interface MappedField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  value: string;
  filled: boolean;
  options?: string[];
  format?: string;
  example?: string;
  auto_filled?: boolean;
  unit?: string;
}

interface MappedSection {
  section: string;
  page: number;
  field_count: number;
  fields: MappedField[];
}

interface ExamInfo {
  skill_test_exempt?: boolean | "免除";
  japanese_test_exempt?: boolean | "免除";
  note?: string;
}

export function registerGeneratePaperForm(server: McpServer) {
  server.tool(
    "suguvisa_paper_form_generate",
    "【紙申請PDFマッピング】申請パターンに対応する紙申請書（別記第30号の5等）の全フィールドにデータを自動マッピング。記入済み/未記入/必須の状態を可視化し、完成度をパーセントで表示。 / Maps applicant data to official paper form PDF fields with completion tracking and required-field highlighting.",
    {
      pattern_id: z.string().describe("申請パターンID（例: 'CHANGE_SSW1_C'） / Application pattern ID / ID pola aplikasi"),
      applicant_data: z.record(z.string()).describe(
        "申請人データ（キー/値ペア） / Applicant data (Key/Value pairs) / Data pemohon (Pasangan Kunci/Nilai)"
      ),
      company_data: z.record(z.string()).optional().describe(
        "所属機関データ（キー/値ペア） / Company data (Key/Value pairs) / Data perusahaan (Pasangan Kunci/Nilai)"
      ),
      industry_field: z.string().optional().describe("分野（例: '農業'） / Industry field (e.g., 'Agriculture') / Bidang industri (mis., 'Pertanian')"),
    },
    { title: "Generate paper form PDF", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ pattern_id, applicant_data, company_data, industry_field }) => {
      const pattern = ruleSets.application_patterns[pattern_id];
      if (!pattern) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ 
              status: "error", 
              message: `パターンID '${pattern_id}' が見つかりません / Pattern ID not found / ID pola tidak ditemukan` 
            }, null, 2),
          }],
        };
      }

      // form_code から form-field-mappings.json のフォーム定義を取得
      const formCode = String(pattern.form_code);
      const formDef: FormDef | undefined = formFieldMappings.forms[formCode];

      if (!formDef) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "error",
              message: `様式 '${formCode}' のフィールド定義が見つかりません / Field definition for form '${formCode}' not found / Definisi bidang untuk formulir '${formCode}' tidak ditemukan`,
              available_forms: Object.keys(formFieldMappings.forms),
            }, null, 2),
          }],
        };
      }

      // 全データをフラットにマージ
      const allData: Record<string, string> = {
        ...applicant_data,
        ...(company_data || {}),
      };

      // パターンから自動入力できるフィールドを追加
      if (!allData.current_visa_type) allData.current_visa_type = String(pattern.from_visa || "");
      if (!allData.desired_visa_type) allData.desired_visa_type = String(pattern.to_visa || "");
      if (industry_field) {
        if (!allData.industry_field) allData.industry_field = industry_field;
      }

      // セクションごとにフィールドマッピングを生成
      const sections: MappedSection[] = [];
      const emptyRequiredFields: string[] = [];
      let totalFields = 0;
      let filledFields = 0;

      for (const section of formDef.sections) {
        const mappedFields: MappedField[] = [];

        for (const field of section.fields) {
          const value = allData[field.id] || "";
          
          const isRequired = !!field.required;
          const mapped: MappedField = {
            id: field.id,
            label: field.label,
            type: field.type,
            required: isRequired,
            value,
            filled: value !== "",
          };

          if (field.options) mapped.options = field.options;
          if (field.format) mapped.format = field.format;
          if (field.example && !value) mapped.example = field.example;
          
          if (field.default && !value) {
            mapped.value = field.default;
            mapped.filled = true;
            mapped.auto_filled = true;
          }
          if (field.unit) mapped.unit = field.unit;

          mappedFields.push(mapped);
          totalFields++;
          
          if (mapped.filled) filledFields++;
          if (isRequired && !mapped.filled) {
            emptyRequiredFields.push(`[${section.section}] ${field.label}`);
          }
        }

        sections.push({
          section: section.section,
          page: section.page,
          field_count: mappedFields.length,
          fields: mappedFields,
        });
      }

      // 試験免除情報をメタデータに含める
      const examInfo: ExamInfo = {};
      if (pattern.exam_exemption) {
        examInfo.skill_test_exempt = pattern.exam_exemption.skill_test;
        examInfo.japanese_test_exempt = pattern.exam_exemption.japanese_test;
        examInfo.note = pattern.exam_exemption.note;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: emptyRequiredFields.length > 0 ? "incomplete" : "ready",
            pattern_id,
            form_code: formCode,
            form_name: formDef.name,
            formal_name: pattern.formal_name,
            total_pages: formDef.total_pages,
            statistics: {
              total_fields: totalFields,
              filled_fields: filledFields,
              completion_rate: `${Math.round((filledFields / totalFields) * 100)}%`,
            },
            empty_required_fields: emptyRequiredFields,
            exam_exemption: examInfo,
            sections,
            instruction: [
              `この対応表を ${String(formDef.name)} の各フィールドに入力してください。 / Fill these mappings into the form ${String(formDef.name)}. / Isi pemetaan ini ke dalam formulir ${String(formDef.name)}.`,
              "required: true のフィールドは必須です。 / 'required: true' fields must be filled. / Bidang 'required: true' wajib diisi.",
              "auto_filled: true のフィールドは自動入力されました。 / 'auto_filled: true' fields were automatically populated. / Bidang 'auto_filled: true' diisi secara otomatis.",
            ].join("\n"),
          }, null, 2),
        }],
      };
    }
  );
}
