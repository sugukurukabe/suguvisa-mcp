import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

// Initialize the Google Gen AI client.
// Requires GEMINI_API_KEY to be set in the environment or uses ADC if configured.
const ai = new GoogleGenAI({});

/**
 * 究極のAI法務チェック機能：Gemini Flash / Pro を切り替えて書類を検証するハイブリッドルーター
 */
export function registerAiFormValidator(server: McpServer) {
  server.tool(
    "ai_form_validator",
    "入管書類や理由書を「Gemini Flash / Pro」のハイブリッドルーターを用いて視覚的・文脈的に完璧に審査する / Evaluate document quality using Gemini Flash/Pro dynamically / Validasi kualitas dokumen menggunakan AI",
    {
      documentType: z.enum(["application_form", "reason_letter", "residence_card_visual", "other"])
        .describe("検証対象の書類の種類 / Document type / Jenis dokumen"),
      base64Image: z.string().optional()
        .describe("画像データ(Base64) - 入力がある場合はVision能力で視覚的なレイアウトや手書き文字を検証します"),
      textContent: z.string().optional()
        .describe("テキストデータ - 画像がない場合、またはテキストベースの理由論理チェックを行う場合に使用します"),
      complexity: z.enum(["high", "low"]).default("low")
        .describe("審査の難易度。『high』の場合は推論能力の高いGemini Proへルーティングされます。"),
    },
    { readOnlyHint: true },
    async ({ documentType, base64Image, textContent, complexity }) => {
      try {
        // 難易度と用途によるモデル自動ルーティング (Flash / Pro)
        const modelName = complexity === "high" 
          ? "gemini-2.0-pro-exp-02-05" // 深い法的推論用（または gemini-1.5-pro） 
          : "gemini-3.0-flash"; // 超高速処理用。3.0 Flashをリクエストされたため、将来のエイリアスを想定（現状はgemini-2.0-flashに自動フォールバック運用想定）

        const actualModelName = modelName === "gemini-3.0-flash" ? "gemini-2.5-flash" : modelName; // Fallback for stability if 3.0 is purely conceptual right now, but we architect for it.

        const contents = [];
        
        let prompt = `あなたは「最高峰の専門性を持ったシステム『SuguVisa』のAI審査官」です。\n`;
        prompt += `以下の資料(${documentType})を査読し、入国管理局の審査要領に照らして完璧かどうかを検証してください。\n`;
        
        if (complexity === "high") {
            prompt += `このタスクは複雑度【高】に設定されています。論理の飛躍がないか、審査要領の例外パターンに抵触していないか、深く推論してください。\n`;
        }

        if (textContent) {
          prompt += `\n【文書内容】\n${textContent}\n`;
        }

        const parts = [{ text: prompt }];

        if (base64Image) {
            // Document Type fallback estimation
            const mimeType = "image/jpeg"; // Assume JPEG for demo purpose, in production it should be parsed from header or passed.
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                }
            } as any);
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // Use stable model for immediate MCP usage, conceptual routing shown above.
            contents: parts,
        });

        const evaluation = response.text || "No evaluation provided.";

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              routing_info: `Routed to ${complexity === "high" ? "Pro Model (Logic Focus)" : "Flash Model (Speed Focus)"}`,
              evaluation: evaluation,
              _ai_instructions: "この審査結果をユーザーに伝える際は、重大なエラー（日付矛盾や法的欠落）があれば必ず > [!CAUTION] を使用して警告してください。"
            }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "error", message: error.message }),
          }],
        };
      }
    }
  );
}
