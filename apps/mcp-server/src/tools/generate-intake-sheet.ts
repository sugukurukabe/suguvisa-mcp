import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");
const fieldSpecific = require("../data/field-specific.json");

interface IntakeField {
  key: string;
  label: string;
  example: string;
  required: boolean;
}

interface IntakeSection {
  title: string;
  fields: IntakeField[];
  note?: string;
}

export function registerGenerateIntakeSheet(server: McpServer) {
  server.tool(
    "generate_intake_sheet",
    "【入力シート自動生成】申請パターンに応じた情報ヒアリングシートを自動作成。クライアント（受入れ機関）に渡して記入してもらうことで、申請に必要な全データを漏れなく収集。分野別の追加項目にも対応。 / Auto-generates a customized intake form for clients to fill out, ensuring all required data is collected without omissions.",
    {
      pattern_id: z.string().describe("申請パターンID（例: 'CHANGE_SSW1_C'） / Application pattern ID / ID pola aplikasi"),
      company_name: z.string().optional().describe("所属機関名 / Company name / Nama perusahaan"),
      applicant_name: z.string().optional().describe("申請人氏名 / Applicant name / Nama pemohon"),
      industry_field: z.string().optional().describe("分野（例: '農業'） / Industry field (e.g., 'Agriculture') / Bidang industri (mis., 'Pertanian')"),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ pattern_id, company_name, applicant_name, industry_field }) => {
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

      const sections: IntakeSection[] = [];

      // === 申請人基本情報 / Applicant Basic Info / Info Dasar Pemohon ===
      sections.push({
        title: "申請人情報 / Applicant Information",
        fields: [
          { key: "full_name_romaji", label: "氏名（ローマ字・パスポート表記） / Full Name (Romaji)", example: "GILANG PERMANA", required: true },
          { key: "full_name_kanji", label: "氏名（漢字）※ある場合 / Full Name (Kanji)", example: "", required: false },
          { key: "furigana", label: "ふりがな / Furigana", example: "ぎらん ぺるまな", required: false },
          { key: "nationality", label: "国籍 / Nationality", example: "インドネシア", required: true },
          { key: "date_of_birth", label: "生年月日（YYYY-MM-DD） / Date of Birth", example: "1995-08-15", required: true },
          { key: "sex", label: "性別 / Sex", example: "男", required: true },
          { key: "marital_status", label: "配偶者の有無 / Marital Status", example: "無", required: true },
          { key: "passport_number", label: "パスポート番号 / Passport Number", example: "C1234567", required: true },
          { key: "passport_expiry", label: "パスポート有効期限 / Passport Expiry", example: "2030-12-31", required: true },
        ],
      });

      // === 在留情報（国内申請のみ）/ Residence Info (Domestic Only) / Info Tinggal ===
      if (pattern_id !== "GRANT_01") {
        sections.push({
          title: "在留情報 / Residence Information",
          fields: [
            { key: "residence_card_number", label: "在留カード番号 / Residence Card No.", example: "AB12345678CD", required: true },
            { key: "current_visa_type", label: "現在の在留資格 / Current Visa Type", example: String(pattern.from_visa), required: true },
            { key: "visa_expiry_date", label: "在留期限 / Visa Expiry Date", example: "2026-09-30", required: true },
            { key: "address_japan", label: "日本の住所 / Address in Japan", example: "鹿児島県...", required: true },
            { key: "phone_japan", label: "電話番号（日本）/ Phone Number (Japan)", example: "090-XXXX-XXXX", required: false },
          ],
        });
      } else {
        // 海外からの入国の場合 / For entry from overseas / Masuk dari luar negeri
        sections.push({
          title: "渡航情報 / Travel Information",
          fields: [
            { key: "home_country_address", label: "本国の住所 / Home Country Address", example: "Jalan Raya...", required: true },
            { key: "home_country_phone", label: "本国の電話番号 / Home Country Phone", example: "+62-xxx-xxxx", required: false },
            { key: "desired_entry_date", label: "入国予定日 / Desired Entry Date", example: "2026-06-01", required: true },
            { key: "desired_landing_port", label: "上陸予定港 / Desired Landing Port", example: "鹿児島空港", required: true },
          ],
        });
      }

      // === 技能実習からの場合 / From TITP / Dari TITP ===
      if (typeof pattern.from_visa === "string" && pattern.from_visa.includes("技能実習")) {
        sections.push({
          title: "技能実習情報 / TITP Information",
          fields: [
            { key: "titp_org_name", label: "実習実施者名 / Implementing Org", example: "○○農園", required: true },
            { key: "titp_supervising_org", label: "監理団体名 / Supervising Org", example: "○○協同組合", required: true },
            { key: "titp_completion_date", label: "実習修了予定日 / TITP Completion Date", example: "2026-03-31", required: true },
            { key: "titp_completion_cert", label: "修了証明書の有無 / Completion Certificate", example: "☐ あり / ☐ なし", required: true },
          ],
        });
      }

      // === 転職の場合 / Job Change / Ganti Pekerjaan ===
      if (pattern_id === "CHANGE_SSW1_D" || pattern_id === "CHANGE_TOKKATSU_D") {
        sections.push({
          title: "前職情報（転職）/ Previous Job Info",
          fields: [
            { key: "previous_company_name", label: "前の雇用主名 / Previous Employer", example: "○○株式会社", required: true },
            { key: "resignation_date", label: "退職日 / Resignation Date", example: "2026-02-28", required: true },
            { key: "resignation_reason", label: "退職理由 / Resignation Reason", example: "契約期間満了", required: true },
            { key: "zuiji_todokede_done", label: "随時届出（退職）済 / Notification Completed", example: "☐ はい / ☐ いいえ", required: true },
          ],
        });
      }

      // === 所属機関情報 / Dispatched Company / Perusahaan Penerima ===
      sections.push({
        title: "所属機関情報（受入れ企業）/ Accepting Organization",
        fields: [
          { key: "company_name", label: "会社名 / Company Name", example: company_name || "株式会社○○", required: true },
          { key: "corporate_number", label: "法人番号（13桁）/ Corporate Number", example: "1234567890123", required: true },
          { key: "representative", label: "代表者氏名 / Representative", example: "山田太郎", required: true },
          { key: "company_address", label: "本社所在地 / Head Office Address", example: "鹿児島県...", required: true },
          { key: "company_phone", label: "電話番号 / Phone Number", example: "0995-XX-XXXX", required: true },
          { key: "work_location", label: "就労場所 / Work Location", example: "同上", required: false },
          { key: "industry_field", label: "特定産業分野 / Industry Field", example: industry_field || "農業", required: true },
          { key: "work_description", label: "業務区分 / Work Description", example: "耕種農業全般", required: true },
        ],
      });

      // === 雇用条件 / Employment Conditions / Syarat Pekerjaan ===
      sections.push({
        title: "雇用条件 / Employment Conditions",
        fields: [
          { key: "monthly_salary", label: "報酬月額（円）/ Monthly Salary", example: "180,000", required: true },
          { key: "hourly_wage", label: "時給（円）/ Hourly Wage", example: "1,100", required: false },
          { key: "contract_start_date", label: "契約開始日 / Contract Start", example: "2026-04-01", required: true },
          { key: "contract_end_date", label: "契約終了日 / Contract End", example: "2027-03-31", required: true },
          { key: "working_hours", label: "所定労働時間（月）/ Monthly Working Hours", example: "160時間", required: true },
          { key: "rest_days", label: "休日 / Rest Days", example: "週1日以上", required: true },
          { key: "overtime_rate", label: "割増率 / Overtime Rate", example: "25%", required: true },
          { key: "housing_type", label: "住居の提供 / Housing Provider", example: "☐ 会社 / ☐ 自己", required: true },
          { key: "housing_cost", label: "住居費（月）/ Housing Cost", example: "20,000", required: false },
        ],
      });

      // === 試験情報 / Exam Info / Info Ujian ===
      const examExemption = pattern.exam_exemption;
      const needsExamSection = !examExemption?.skill_test || examExemption.skill_test === false;

      if (needsExamSection) {
        const examFields: IntakeField[] = [];
        
        const field = industry_field && fieldSpecific.fields[industry_field] 
          ? fieldSpecific.fields[industry_field] 
          : null;

        if (!examExemption?.skill_test || examExemption.skill_test === false) {
          examFields.push(
            { key: "skill_test_name", label: "技能試験名 / Skill Test", example: String(field?.skill_test?.name || "農業技能測定試験"), required: true },
            { key: "skill_test_pass_date", label: "合格日 / Pass Date", example: "2025-12-01", required: true },
            { key: "skill_test_cert_number", label: "証明書番号 / Certificate Number", example: "", required: true },
          );
        } else {
          examFields.push(
            { key: "skill_test_exempt_reason", label: "試験免除理由 / Exemption Reason", example: String(examExemption.note || ""), required: true },
          );
        }

        if (!examExemption?.japanese_test || examExemption.japanese_test === false) {
          examFields.push(
            { key: "japanese_test_name", label: "日本語試験名 / Japanese Test", example: "JFT-Basic / JLPT N4", required: true },
            { key: "japanese_test_pass_date", label: "合格日 / Pass Date", example: "2025-11-01", required: true },
          );
        }

        sections.push({
          title: "試験情報 / Exam Information",
          note: String(examExemption?.note || ""),
          fields: examFields,
        });
      }

      // === 支援体制 / Support System / Sistem Dukungan ===
      sections.push({
        title: "支援体制 / Support System",
        fields: [
          { key: "support_type", label: "支援実施方式 / Support Type", example: "☐ 自社 / ☐ 委託", required: true },
          { key: "support_org_name", label: "登録支援機関名 / Support Org Name", example: "スグクル株式会社", required: false },
          { key: "support_org_number", label: "登録番号 / Registration Number", example: "", required: false },
        ],
      });

      // === 分野固有セクション / Field-specific / Khusus Bidang ===
      if (industry_field && fieldSpecific.fields[industry_field]) {
        const fieldInfo = fieldSpecific.fields[industry_field];

        if (industry_field === "農業") {
          sections.push({
            title: "農業分野固有情報 / Agriculture Info",
            note: String(fieldInfo.seasonal_notes || ""),
            fields: [
              { key: "farming_type", label: "農業区分 / Farming Type", example: "☐ 耕種 / ☐ 畜産", required: true },
              { key: "farm_address", label: "農場所在地 / Farm Address", example: "鹿児島県...", required: true },
              { key: "farm_area", label: "農場面積(ha) / Farm Area", example: "5.0", required: false },
              { key: "crop_types", label: "作物・家畜 / Crops/Livestock", example: "さつまいも", required: true },
              { key: "dispatch_type", label: "雇用形態 / Employment Type", example: "☐ 直接雇用 / ☐ 派遣", required: true },
            ],
          });
        }
      }

      // === パターン固有の追加書類 / Additional Documents / Dokumen Tambahan ===
      if (Array.isArray(pattern.special_documents) && pattern.special_documents.length > 0) {
        sections.push({
          title: "追加書類（要準備）/ Additional Documents",
          fields: pattern.special_documents.map((doc: unknown, i: number) => ({
            key: `special_doc_${i + 1}`,
            label: String(doc),
            example: "☐ 準備済み",
            required: true,
          })),
        });
      }

      // === Markdown生成 / Generate Markdown ===
      let md = `# 入力シート: ${String(pattern.formal_name)}\n`;
      md += `**${String(pattern.from_visa)} → ${String(pattern.to_visa)}** (${pattern_id})\n\n`;
      if (applicant_name) md += `申請人: **${applicant_name}**\n\n`;
      md += `> ⚠️ 標準処理日数 / Typical Processing Days: ${String(pattern.typical_processing_days)}\n\n`;

      for (const section of sections) {
        md += `## ${section.title}\n`;
        if (section.note) md += `> ${section.note}\n`;
        md += "\n";
        md += "| # | 項目 (Item) | 必須 (Req) | 入力欄 (Input) | 記入例 (Example) |\n";
        md += "|---|-------------|:----------:|----------------|------------------|\n";
        for (let i = 0; i < section.fields.length; i++) {
          const f = section.fields[i];
          md += `| ${i + 1} | ${f.label} | ${f.required ? "✅" : ""} | | ${f.example || ""} |\n`;
        }
        md += "\n";
      }

      return {
        content: [{
          type: "text" as const,
          text: md,
        }],
      };
    }
  );
}
