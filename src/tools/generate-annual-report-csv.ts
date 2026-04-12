import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { annualReportCsvSchema, AnnualReportCsvData } from "../data/annual-report-schema.js";

const REPORT_CSV_COLUMNS = Object.keys(annualReportCsvSchema.shape) as (keyof AnnualReportCsvData)[];

export async function generateAnnualReportCsvHandler(reports: any[]) {
      if (!Array.isArray(reports) || reports.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ 
              status: "error", 
              message: "報告対象データが空です / Report data is empty" 
            }, null, 2),
          }],
        };
      }

      const rows: string[] = [];
      const paperDataList: any[] = [];
      const errors: string[] = [];

      reports.forEach((reportData, index) => {
        const parsed = annualReportCsvSchema.safeParse(reportData);
        
        if (!parsed.success) {
          const fieldErrors = parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
          errors.push(`行(Report) ${index + 1}: \n  - ${fieldErrors.join("\n  - ")}`);
        } else {
          // 成功した場合はCSV用に整形
          const rowData = REPORT_CSV_COLUMNS.map(col => {
            const val = String(parsed.data[col as keyof AnnualReportCsvData] ?? "");
            // CSV エスケープ
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          });
          rows.push(rowData.join(","));
          
          // 紙媒体/Excel出力用の正規化済みJSONデータも蓄積
          paperDataList.push(parsed.data);
        }
      });

      if (errors.length > 0) {
         return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "missing_fields_or_validation_error",
              message: "定期報告のバリデーションエラーが発生しました。欠落している情報を補完して再度実行してください。",
              errors
            }, null, 2),
          }],
        };       
      }

      // ヘッダー行
      const header = REPORT_CSV_COLUMNS.join(",");
      const csv = [header, ...rows].join("\n");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "ok",
            report_count: reports.length,
            column_count: REPORT_CSV_COLUMNS.length,
            csv_content: csv,
            paper_form_data: paperDataList,
            important_notice: [
              "⚠️ 【法改正対応版】2025年4月より、このデータは四半期ではなく『年1回（定期届出）』として扱われます。",
              "👉 【一括オンライン申請】: 'csv_content' の中身をCSVファイルとして保存し、出入国在留管理庁へアップロード可能です。",
              "👉 【書面・郵送申請】: 'paper_form_data' のデータ構造を使用し、ExcelやPDFへテンプレート流し込みを行ってください。"
            ],
          }, null, 2),
        }],
      };
}

export function registerGenerateAnnualReportCsv(server: McpServer) {
  server.tool(
    "generate_annual_report_csv",
    "【定期届出CSV生成】年1回の特定技能定期届出（受入れ状況・活動状況・支援実施状況）をオンライン一括申請用CSVとして出力。2025年4月改正の新フォーマットに対応。紙提出用データも同時生成。 / Generates annual periodic report CSV for ISA online submission, compatible with the April 2025 format revision.",
    {
      reports: z.array(z.record(z.any())).describe(
        "報告対象となる申請人データの配列。各オブジェクトのキー: " + REPORT_CSV_COLUMNS.join(", ") + "\n※日付や数字などはSuguVisaが自動的に正規化します。不足データはエラーになります。"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ reports }) => {
      return generateAnnualReportCsvHandler(reports);
    }
  );
}
