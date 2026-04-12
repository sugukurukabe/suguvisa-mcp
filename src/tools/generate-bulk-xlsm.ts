import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs";
import { officialCsvSchema, OfficialCsvData, splitRomajiName, resolveNationalityCode, resolveIndustryFieldCode, resolveApplicationType } from "../data/csv-schema.js";
import XlsxPopulate from "xlsx-populate";

/**
 * 前処理: ユーザーフレンドリーな入力を正式フォーマットに変換
 */
function preprocessApplicant(raw: Record<string, any>): Record<string, any> {
  const data = { ...raw };
  if (!data.family_name_romaji && !data.given_name_romaji && (data.name_romaji || data.full_name || data.name)) {
    const fullName = data.name_romaji || data.full_name || data.name;
    const { family, given } = splitRomajiName(String(fullName));
    data.family_name_romaji = family;
    data.given_name_romaji = given;
  }
  if (!data.nationality_code && data.nationality) {
    data.nationality_code = resolveNationalityCode(String(data.nationality));
  }
  if (!data.industry_field_code && data.industry_field) {
    data.industry_field_code = resolveIndustryFieldCode(String(data.industry_field));
  }
  if (data.application_type && !/^[123]$/.test(String(data.application_type))) {
    data.application_type = resolveApplicationType(String(data.application_type));
  }
  return data;
}

// 簡易的な日本の住所分割（都道府県、市区町村、それ以降）
function splitAddress(fullAddress: string) {
  let pref = "";
  let city = "";
  let street = fullAddress; // デフォルトはそのまま

  const match = fullAddress.match(/^(.+?[都道府県])(.+?[市区町村])(.+)$/);
  if (match) {
    pref = match[1];
    city = match[2];
    street = match[3];
  } else {
    // 市区郡町村が見つからない場合は都道府県だけ取る
    const prefMatch = fullAddress.match(/^(.+?[都道府県])(.+)$/);
    if (prefMatch) {
      pref = prefMatch[1];
      street = prefMatch[2];
    }
  }

  return { pref, city, street };
}

// Mapping SuguVisa schema fields to 1-based column indexes in the ISA Excel "申請情報入力" sheet.
const COLUMN_MAP: Partial<Record<keyof OfficialCsvData, number>> = {
  nationality_code: 2, // 国籍・地域
  date_of_birth: 3, // 生年月日
  // 氏名(Col 4) は family_name + given_name で合成する
  sex: 5, // 性別
  passport_number: 17, // 旅券番号
  current_visa_type: 19, // 現に有する在留資格
  visa_expiry_date: 21, // 在留期間の満了日
  residence_card_number: 23, // 在留カード番号
  desired_visa_type: 26, // 希望する在留資格
  desired_period: 27, // 希望する在留期間
};

// Mapping for "申請情報入力(区分V)" sheet (Specific Skilled Worker details)
const COLUMN_MAP_V: Partial<Record<keyof OfficialCsvData, number>> = {
  contract_start_date: 82, // (1)雇用契約期間(始期)
  contract_end_date: 83, // (1)雇用契約期間(終期)
  industry_field_code: 84, // (2)従事すべき業務の内容　特定産業分野
  work_description: 85, // (2)従事すべき業務の内容　業務区分
  monthly_salary: 97, // (4)月額報酬
  company_name: 139, // (1)氏名又は名称
  corporate_number: 141, // (2)法人番号
  company_phone: 153, // (5)電話番号
  representative: 157, // (9)代表者の氏名
};

export async function generateBulkXlsmHandler(
  application_type: "1" | "2" | "3",
  applicants: any[]
): Promise<any> {
  const appType = application_type;

  if (!Array.isArray(applicants) || applicants.length === 0) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ status: "error", message: "少なくとも1件の申請人データが必要です" }, null, 2)
      }]
    };
  }

  const errors: string[] = [];
  const parsedApplicants: OfficialCsvData[] = [];

  applicants.forEach((a, index) => {
    const preprocessed = preprocessApplicant(a);
    const parsed = officialCsvSchema.safeParse(preprocessed);
    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      errors.push(`Row ${index + 1}: \n  - ${fieldErrors.join("\n  - ")}`);
    } else {
      parsedApplicants.push(parsed.data);
    }
  });

  if (errors.length > 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            status: "validation_error",
            message: "バリデーションエラーが発生しました。不足している情報をユーザーに聞くか、フォーマットを修正してください。",
            errors,
          }, null, 2),
        },
      ],
    };
  }

  // 2. テンプレートの選定
  let templateName = "一括登録用Excelツール_変更 シート.xlsm";
  if (appType === "1") templateName = "一括登録用Excelツール_認定 シート.xlsm";
  else if (appType === "2") templateName = "一括登録用Excelツール_更新 シート.xlsm";

  const templatePath = path.resolve(process.cwd(), templateName);
  if (!fs.existsSync(templatePath)) {
     return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ status: "error", message: `Excel template not found: ${templatePath}` }, null, 2)
      }]
     };
  }

  // 3. XLSMファイルの読み書き処理
  const workbook = await XlsxPopulate.fromFileAsync(templatePath);
  
  const mainSheet = workbook.sheets().find((s: any) => {
    const name = s.name();
    return name.startsWith("申請情報入力") && !name.includes("区分") && !name.includes("同時");
  });

  const vSheet = workbook.sheet("申請情報入力(区分V)");

  if (!mainSheet) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ status: "error", message: "Failed to find the main input sheet in the Excel template." }, null, 2)
      }]
     };
  }

  const ROW_START = 8;
  
  parsedApplicants.forEach((data, index) => {
    const rowIndex = ROW_START + index;
    
    Object.keys(COLUMN_MAP).forEach((key) => {
      const colIndex = COLUMN_MAP[key as keyof OfficialCsvData];
      if (colIndex) {
        mainSheet.cell(rowIndex, colIndex).value(data[key as keyof OfficialCsvData]);
      }
    });

    const fullName = `${data.family_name_romaji} ${data.given_name_romaji}`;
    mainSheet.cell(rowIndex, 4).value(fullName);

    if (vSheet) {
      Object.keys(COLUMN_MAP_V).forEach((key) => {
        const colIndex = COLUMN_MAP_V[key as keyof OfficialCsvData];
        if (colIndex && data[key as keyof OfficialCsvData] !== undefined) {
          vSheet.cell(rowIndex, colIndex).value(data[key as keyof OfficialCsvData]);
        }
      });

      if (data.corporate_number) {
        vSheet.cell(rowIndex, 140).value("1");
      } else {
        vSheet.cell(rowIndex, 140).value("2");
      }

      if (data.company_address) {
        const parsedAddr = splitAddress(data.company_address);
        if (parsedAddr.pref) vSheet.cell(rowIndex, 150).value(parsedAddr.pref);
        if (parsedAddr.city) vSheet.cell(rowIndex, 151).value(parsedAddr.city);
        if (parsedAddr.street) vSheet.cell(rowIndex, 152).value(parsedAddr.street);
        if (!parsedAddr.pref && !parsedAddr.city && parsedAddr.street) {
           vSheet.cell(rowIndex, 151).value(parsedAddr.street);
        }
      }
    }
  });

  const outDir = path.resolve(process.cwd(), "..", "output");
  if (!fs.existsSync(outDir)) {
     fs.mkdirSync(outDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const outFileName = `一括申請ファイル_${appType === "1" ? "認定" : appType === "2" ? "更新" : "変更"}_${timestamp}.xlsm`;
  let outPath = path.join(outDir, outFileName);

  try {
    await workbook.toFileAsync(outPath);
  } catch (err: any) {
    if (err.code === "EBUSY" || err.message.includes("EBUSY") || err.message.includes("locked")) {
      const retryPath = path.join(outDir, outFileName.replace(".xlsm", "_retry.xlsm"));
      try {
        await workbook.toFileAsync(retryPath);
        outPath = retryPath;
      } catch (retryErr: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "error", message: "Excelファイルを保存できませんでした。開かれている場合は閉じてから再度お試しください。" }, null, 2)
          }]
        };
      }
    } else {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "error", message: `保存時に予期せぬエラーが発生しました: ${err.message}` }, null, 2)
          }]
        };
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          status: "success",
          message: "Excelファイル（マクロ付）の生成に成功しました。指定されたOutputPathに保存済みです。",
          applicant_count: parsedApplicants.length,
          output_path: outPath,
        }, null, 2),
      },
    ],
  };
}

export function registerGenerateBulkXlsm(server: McpServer) {
  server.tool(
    "generate_bulk_xlsm",
    "【一括申請Excel生成】出入国在留管理庁の公式一括申請用Excelテンプレート(.xlsm)に申請人データを自動注入。マクロを破壊せずにデータだけを正確に埋め込む独自技術。認定・更新・変更の3種類に対応。 / Injects validated applicant data into the official ISA .xlsm bulk application template without breaking macros.",
    {
      application_type: z.enum(["1", "2", "3"]).describe("1:認定(COE), 2:更新(Renewal), 3:変更(Change)"),
      applicants: z.array(z.record(z.any())).describe("申請人データの配列。必須要件はcsv-schema.tsによって厳密にチェックされます。"),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ application_type, applicants }) => {
       return await generateBulkXlsmHandler(application_type, applicants);
    }
  );
}
