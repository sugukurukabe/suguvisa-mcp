import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import os from "os";

export function registerGeneratePeriodicNotification(server: McpServer) {
  server.tool(
    "generate_periodic_notification_forms",
    "【定期届出】Supabaseや解析されたデータをもとに、定期届出（参考様式第3-6号等）のExcelまたは電子届出用CSVを自動生成し、ダウンロードリンク（ローカルパス）を提供するツール。 / Autogenerate the Reference Form 3-6 (Excel/CSV) for the actual periodic notification using collected data and return the file path.",
    {
      company_name: z.string().describe("届出を行う法人名"),
      reporting_year: z.number().describe("対象となる前年度（例: 2025年の場合は、2025年4月1日〜2026年3月31日）"),
      output_format: z.enum(["excel", "csv"]).describe("生成するファイルフォーマット"),
      workers_data: z.array(z.object({
        name: z.string(),
        residence_card_number: z.string(),
        total_working_hours: z.number(),
        total_payment: z.number(),
        status: z.enum(["active", "resigned", "on_leave"])
      })).optional().describe("届出対象となる特定技能外国人のリスト。省略時はダミーデータでテスト生成します。"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ company_name, reporting_year, output_format, workers_data }) => {
      
      const workers = workers_data || [
        { name: "GILANG PERMANA", residence_card_number: "AB12345678CD", total_working_hours: 1920, total_payment: 2400000, status: "active" as const },
        { name: "ERNA APRILLIYA", residence_card_number: "EF98765432GH", total_working_hours: 1850, total_payment: 2350000, status: "active" as const }
      ];

      const tempDir = os.tmpdir();
      const fileName = `PeriodicNotification_${company_name.replace(/\s+/g, '_')}_${reporting_year}_${Date.now()}.${output_format === "excel" ? "xlsx" : "csv"}`;
      const filePath = path.join(tempDir, fileName);

      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "SuguVisa AI";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("参考様式第3-6号");

        if (output_format === "excel") {
          // 簡単なヘッダー（実際のExcelテンプレートに流し込む前提のデモ）
          sheet.columns = [
            { header: "受入れ機関名", key: "company", width: 25 },
            { header: "対象年度", key: "year", width: 15 },
            { header: "氏名", key: "name", width: 25 },
            { header: "在留カード番号", key: "card", width: 20 },
            { header: "総実労働時間", key: "hours", width: 15 },
            { header: "報酬総額", key: "payment", width: 15 },
            { header: "ステータス", key: "status", width: 15 },
          ];

          workers.forEach(w => {
            sheet.addRow({
              company: company_name,
              year: reporting_year,
              name: w.name,
              card: w.residence_card_number,
              hours: w.total_working_hours,
              payment: w.total_payment,
              status: w.status === "active" ? "在籍" : w.status === "resigned" ? "退職" : "休業"
            });
          });

          await workbook.xlsx.writeFile(filePath);

        } else if (output_format === "csv") {
          // 電子届出システム用CSV形式（e-Gov連携用などを想定）
          const csvHeaders = ["CompanyName", "ReportingYear", "WorkerName", "ResidenceCardNumber", "TotalWorkingHours", "TotalPayment", "Status"];
          sheet.addRow(csvHeaders);
          
          workers.forEach(w => {
            sheet.addRow([
              company_name,
              reporting_year,
              w.name,
              w.residence_card_number,
              w.total_working_hours,
              w.total_payment,
              w.status
            ]);
          });

          await workbook.csv.writeFile(filePath);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                message: `${output_format.toUpperCase()}ファイルの自動生成が完了しました。`,
                file_path: filePath,
                records_processed: workers.length,
                _ai_instructions: "ユーザーに対して生成されたファイルパスを案内し、必要であればダウンロードして中身を確認してもらうよう伝えてください。"
              }, null, 2)
            }
          ]
        };

      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "error",
                message: `ファイル生成中にエラーが発生しました: ${error.message}`
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}
