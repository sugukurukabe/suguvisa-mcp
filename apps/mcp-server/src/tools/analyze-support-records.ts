import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateWithImage } from "../lib/vertex-ai.js";

interface AuditResult {
  is_compliant: boolean;
  total_working_hours: number | null;
  overtime_hours: number | null;
  base_salary: number | null;
  deductions: number | null;
  findings: string[];
}

export function registerAnalyzeSupportRecords(server: McpServer) {
  server.tool(
    "suguvisa_support_records_analyze",
    "【定期届出】賃金台帳や出勤簿などのPDF/画像をAI(Document AI / Gemini)で解析・監査し、特定技能の基準（同等報酬、労働時間上限など）を満たしているかチェックするツール。 / Analyze wage ledgers and attendance records to ensure compliance with SSW regulations (equal pay, working hours) using Document AI / Gemini.",
    {
      file_base64: z.string().describe("対象ファイル（賃金台帳・出勤簿）のBase64エンコードデータ"),
      mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).describe("ファイルのMIMEタイプ"),
      document_type: z.enum(["wage_ledger", "attendance_record", "support_record"]).describe("検証するドキュメントの種類（賃金台帳、出勤簿、支援実施記録）"),
      expected_base_salary: z.number().optional().describe("雇用条件書に記載されている予定基本給(比較用)"),
    },
    { title: "Analyze support records (OCR)", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ file_base64, mime_type, document_type, expected_base_salary }) => {
      try {
        const prompt = `あなたは出入国在留管理庁の審査官をサポートするAIオーディターです。
対象のドキュメント（${document_type}）を解析し、以下のJSON形式で監査結果を出力してください。
解析できない場合は null を設定してください。

【出力フォーマット】
{
  "is_compliant": true または false (法令違反の疑いがある場合は false),
  "total_working_hours": 総実労働時間 (数値),
  "overtime_hours": 時間外労働時間 (数値),
  "base_salary": 基本給・基本賃金額 (数値),
  "deductions": 控除額合計 (数値),
  "findings": ["発見事項1", "違反疑いがあればその理由", "..."]
}

【チェック基準】
- 賃金台帳の場合: 基本給が最低賃金や予定基本給(${expected_base_salary || '不明'})を下回っていないか。不当な天引き(deductions)がないか。
- 出勤簿の場合: 残業時間が法定上限(月45時間等)を継続して超えていないか。`;

        // GCPの最高の機能である Gemini (Vertex AI) を用いて推論と抽出を同時に行う
        const responseText = await generateWithImage(prompt, file_base64, mime_type);
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("AIが有効なJSONを返しませんでした。");
        }
        
        const auditResult: AuditResult = JSON.parse(jsonMatch[0]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                auditResult,
                _ai_instructions: "監査結果を元に、定期届出で『理由書』などの追加説明が必要かどうかを判定してユーザーに提案してください。"
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
                message: error.message,
                _ai_instructions: "ユーザーにファイルが鮮明か確認し、手動での入力支援を案内してください。"
              }, null, 2)
            }
          ]
        };
      }
    }
  );
}
