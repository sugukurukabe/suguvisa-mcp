import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface ValidationResult {
  valid: boolean;
  message: string;
  daysLeft?: number;
  monthsLeft?: number;
}

/** 在留カード番号形式: 2文字アルファベット + 8桁数字 + 2文字アルファベット */
export function validateResidenceCardNumber(value: string): ValidationResult {
  const pattern = /^[A-Z]{2}\d{8}[A-Z]{2}$/;
  if (pattern.test(value)) return { valid: true, message: "OK" };
  return { valid: false, message: "在留カード番号は AA12345678BB 形式です / Must be format AA12345678BB / Harus berformat AA12345678BB" };
}

/** 法人番号: 13桁の数字（チェックデジット検証付き） */
export function validateCorporateNumber(value: string): ValidationResult {
  const pattern = /^\d{13}$/;
  if (!pattern.test(value)) return { valid: false, message: "法人番号は13桁の数字です / Must be 13 digits / Harus 13 digit" };

  // チェックデジット検証（法人番号規則に基づく）
  const digits = value.split("").map(Number);
  const checkDigit = digits[0];
  let sum = 0;
  for (let i = 1; i < 13; i++) {
    const nthFromRight = 13 - i;
    const weight = (nthFromRight % 2 === 1) ? 1 : 2;
    sum += digits[i] * weight;
  }
  const remainder = sum % 9;
  const expected = remainder === 0 ? 0 : (9 - remainder);
  if (checkDigit !== expected) {
    return { valid: false, message: `法人番号のチェックデジットが不正です / Invalid check digit / Nomor periksa tidak valid` };
  }
  return { valid: true, message: "OK" };
}

/** ふりがな: ひらがなのみ */
export function validateFurigana(value: string): ValidationResult {
  const pattern = /^[\u3040-\u309F\u30FC\s]+$/;
  if (pattern.test(value)) return { valid: true, message: "OK" };
  return { valid: false, message: "ふりがなにはひらがなのみ使用できます / Hiragana only / Hanya hiragana" };
}

/** 日付フォーマット: YYYY-MM-DD */
export function validateDateFormat(value: string): ValidationResult {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(value)) return { valid: false, message: "日付は YYYY-MM-DD 形式で入力してください / Use YYYY-MM-DD format / Gunakan format YYYY-MM-DD" };
  const date = new Date(value);
  if (isNaN(date.getTime())) return { valid: false, message: "無効な日付です / Invalid date / Tanggal tidak valid" };
  return { valid: true, message: "OK" };
}

/** 在留期限チェック */
export function validateExpiryDate(value: string): ValidationResult {
  const dateResult = validateDateFormat(value);
  if (!dateResult.valid) return dateResult;
  const [y, m, d] = value.split("-").map(Number);
  const expiry = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return { valid: false, message: "在留期限が既に超過しています / Expiry date has passed / Tanggal kedaluwarsa telah berlalu", daysLeft };
  if (daysLeft <= 14) return { valid: true, message: `⚠️ 在留期限まで残り${daysLeft}日 / ${daysLeft} days remaining / Tersisa ${daysLeft} hari`, daysLeft };
  if (daysLeft <= 60) return { valid: true, message: `在留期限まで残り${daysLeft}日 / ${daysLeft} days remaining / Tersisa ${daysLeft} hari`, daysLeft };
  return { valid: true, message: "OK", daysLeft };
}

/** パスポート番号の基本検証 */
export function validatePassportNumber(value: string): ValidationResult {
  // 一般的なパスポート番号: 6〜9文字の英数字
  const pattern = /^[A-Z0-9]{6,9}$/;
  if (pattern.test(value)) return { valid: true, message: "OK" };
  // 小文字が含まれている場合
  if (/^[a-zA-Z0-9]{6,9}$/.test(value)) {
    return { valid: false, message: "パスポート番号は大文字で入力してください / Use uppercase letters / Gunakan huruf besar" };
  }
  return { valid: false, message: "パスポート番号は6〜9文字の英数字（大文字）です / 6-9 alphanumeric characters (uppercase) / 6-9 karakter alfanumerik (huruf besar)" };
}

/** 電話番号の基本検証 */
export function validatePhoneNumber(value: string): ValidationResult {
  // 日本の電話番号（固定 or 携帯）or 国際番号
  const cleaned = value.replace(/[-\s()]/g, "");
  if (/^0\d{9,10}$/.test(cleaned)) return { valid: true, message: "OK" };
  if (/^\+\d{10,15}$/.test(cleaned)) return { valid: true, message: "OK（国際番号 / Intl / Intl）" };
  return { valid: false, message: "電話番号の形式が不正です / Invalid phone number format / Format nomor telepon tidak valid" };
}

/** 特定技能1号 通算在留期間の検証 */
export function validateTotalSSW1Period(value: string): ValidationResult {
  const months = parseInt(value, 10);
  if (isNaN(months) || months < 0) return { valid: false, message: "通算在留期間は0以上の整数（月）で入力してください / Must be an integer >= 0 / Harus bilangan bulat >= 0" };
  const maxMonths = 60; // 5年 = 60ヶ月
  const monthsLeft = maxMonths - months;
  if (monthsLeft <= 0) return { valid: false, message: `通算在留期間の上限（5年/60ヶ月）に達しています / Reached the 5-year limit / Mencapai batas 5 tahun`, monthsLeft: 0 };
  if (monthsLeft <= 6) return { valid: true, message: `⚠️ 上限まで残り${monthsLeft}ヶ月 / ${monthsLeft} months remaining until limit / ${monthsLeft} bulan tersisa sampai batas`, monthsLeft };
  return { valid: true, message: `OK（残り${monthsLeft}ヶ月 / ${monthsLeft} months left / ${monthsLeft} bulan tersisa）`, monthsLeft };
}

/** 特定技能2号 技能測定試験の合格確認 */
export function validateSSW2Test(value: string): ValidationResult {
  const normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized.includes("合格") || normalized.includes("免除") || normalized.includes("有")) {
    return { valid: true, message: "OK（2号試験要件 確認済 / SSW2 Test Confirmed）" };
  }
  return { valid: false, message: "特定技能2号の申請には「2号技能測定試験等の合格」又は該当要件を満たすことが必須です / Passing the SSW2 skill evaluation test is mandatory for SSW2 / Lulus ujian evaluasi keterampilan SSW2 wajib untuk SSW2" };
}

export function registerValidateData(server: McpServer) {
  server.tool(
    "validate_application_data",
    "申請データの入力検証を実行する。 / Validate application data input. / Validasi input data aplikasi.",
    {
      fields: z.record(z.string()).describe(
        "検証するフィールドのキー/値 / Key/value fields to validate / Bidang kunci/nilai untuk divalidasi"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ fields }) => {
      const results: Record<string, ValidationResult> = {};
      let allValid = true;
      let errorCount = 0;
      let warningCount = 0;

      for (const [key, value] of Object.entries(fields)) {
        let result: ValidationResult;

        if (key.includes("residence_card") || key.includes("zairyu_card")) {
          result = validateResidenceCardNumber(value);
        } else if (key.includes("corporate_number") || key.includes("hojin_bango")) {
          result = validateCorporateNumber(value);
        } else if (key.includes("furigana") || key.includes("kana")) {
          result = validateFurigana(value);
        } else if (key.includes("passport")) {
          result = validatePassportNumber(value);
        } else if (key.includes("phone") || key.includes("tel")) {
          result = validatePhoneNumber(value);
        } else if (key.includes("total_ssw1") || key.includes("tsussan")) {
          result = validateTotalSSW1Period(value);
        } else if (key.includes("expiry") || key.includes("kigen")) {
          result = validateExpiryDate(value);
        } else if (key.includes("date") || key.includes("_bi")) {
          result = validateDateFormat(value);
        } else if (key.includes("ssw2_test") || key.includes("skill_test")) {
          result = validateSSW2Test(value);
        } else {
          result = { valid: true, message: "検証ルールなし（スキップ）/ No validation rule (Skipped) / Tidak ada aturan (Dilewati)" };
        }

        results[key] = result;
        if (!result.valid) {
          allValid = false;
          errorCount++;
        }
        if (result.message.includes("⚠️")) warningCount++;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: allValid ? (warningCount > 0 ? "valid_with_warnings" : "all_valid") : "has_errors",
            summary: {
              total_fields: Object.keys(fields).length,
              errors: errorCount,
              warnings: warningCount,
              passed: Object.keys(fields).length - errorCount,
            },
            results,
            _ai_instructions:
              !allValid
                ? "❌ バリデーションエラーがあります。以下の形式で提示してください：\n" +
                  "1. エラーのあるフィールドを赤い ❌ 付きの表形式で表示\n" +
                  "2. 警告（⚠️）があるフィールドは黄色で表示\n" +
                  "3. 各エラーの修正方法を具体的に案内する\n" +
                  "4. 在留期限が14日以内の場合は > [!CAUTION] で緊急警告を出す"
                : warningCount > 0
                ? "⚠️ すべて有効ですが警告があります。警告項目を > [!WARNING] で強調表示してください。在留期限や通算期間の残りが少ない場合は特に目立たせてください。"
                : "✅ すべてのフィールドが有効です。次のステップ（書類生成: generate_online_csv or generate_bulk_xlsm）を提案してください。",
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "check_csv_missing_fields",
    "オンライン申請のCSV生成前に、必須フィールドが揃っているか、およびスキーマに沿って正しく入力されているかをチェックする。 / Pre-check missing/invalid CSV fields.",
    {
      applicant: z.record(z.any()).describe(
        "事前チェックしたい申請人データ1件 / Single applicant data object to pre-check"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ applicant }) => {
      // 動的インポートを利用して依存関係を引き込む (循環参照防止)
      const { officialCsvSchema } = await import("../data/csv-schema.js");

      const parsed = officialCsvSchema.safeParse(applicant);
      if (parsed.success) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "ready",
              message: "すべての必須データが揃っており、形式も正しいです。",
              _ai_instructions: "✅ CSV生成の準備完了です。generate_online_csv または generate_bulk_xlsm でCSV/Excelを生成できることをユーザーに伝えてください。",
            }, null, 2)
          }]
        };
      }

      const missingOrInvalid = parsed.error.issues.map(issue => ({
        field: issue.path.join("."),
        error: issue.message
      }));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "missing",
            message: "不足しているか、または形式が誤っているフィールドがあります。",
            missing_fields: missingOrInvalid
          }, null, 2)
        }]
      };
    }
  );
}
