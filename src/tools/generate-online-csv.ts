import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { officialCsvSchema, OfficialCsvData } from "../data/csv-schema.js";

/**
 * オンライン申請CSV列定義 / Online Application CSV Column Definition
 *
 * ⚠️ 入管の正式な一括申請CSVは専用Excelテンプレート(.xlsm)から生成する仕様です。
 */
const CSV_COLUMNS = Object.keys(officialCsvSchema.shape) as (keyof OfficialCsvData)[];

export function registerGenerateOnlineCsv(server: McpServer) {
  server.tool(
    "generate_online_csv",
    "オンライン申請用のCSVデータを生成する。 / Generate CSV data for online application. 必須フィールドや特定フォーマット（YYYYMMDDなど）を厳格にチェックし、エラーがあれば不足情報を返します。",
    {
      applicants: z.array(z.record(z.any())).describe(
        "申請人データの配列。各オブジェクトのキー: " + CSV_COLUMNS.join(", ") + "\n※日付は「2000年7月7日」といった自然言語でもパースを試みますが、エラーが出た場合はYYYYMMDDで再入力してください。"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ applicants }) => {
      if (!Array.isArray(applicants) || applicants.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ 
              status: "error", 
              message: "申請人データが空です / Applicant data is empty" 
            }, null, 2),
          }],
        };
      }

      const rows: string[] = [];
      const errors: string[] = [];

      applicants.forEach((a, index) => {
        const parsed = officialCsvSchema.safeParse(a);
        
        if (!parsed.success) {
          const fieldErrors = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
          errors.push(`行(Applicant) ${index + 1}: \n  - ${fieldErrors.join("\n  - ")}`);
        } else {
          // 成功した場合はCSV用に整形
          const rowData = CSV_COLUMNS.map(col => {
            const val = String(parsed.data[col as keyof OfficialCsvData] ?? "");
            // CSV エスケープ
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          });
          rows.push(rowData.join(","));
        }
      });

      if (errors.length > 0) {
         return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "missing_fields_or_validation_error",
              message: "バリデーションエラーが発生しました。不足している情報をユーザーに聞くか、フォーマットを修正して再度ツールを実行してください。",
              errors
            }, null, 2),
          }],
        };       
      }

      // ヘッダー行
      const header = CSV_COLUMNS.join(",");
      const csv = [header, ...rows].join("\n");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "ok",
            applicant_count: applicants.length,
            column_count: CSV_COLUMNS.length,
            csv_content: csv,
            important_notice: [
              "⚠️ このCSVは参考フォーマットです。正式なオンライン申請には、出入国在留管理庁配布の最新Excelテンプレート(.xlsm)を使用してください。",
              "DL: https://www.moj.go.jp/isa/applications/guide/onlineshinsei_index.html",
              "バリデーションを通過し、日付や数字などのフォーマットは正規化済みの状態です。"
            ],
          }, null, 2),
        }],
      };
    }
  );
}
