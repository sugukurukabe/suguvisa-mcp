import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

const client = new DocumentProcessorServiceClient();

/**
 * 【最高峰のOCR/Extractor】Document AI カスタムモデル（Generative AI統合）を呼び出すMCPツール
 */
export function registerAdvancedDocExtractor(server: McpServer) {
  server.tool(
    "advanced_doc_extractor",
    "入管用の特殊で複雑な表やチェックボックスを含む書類をDocument AIで完璧に抽出します / Perfect extraction of complex ISA forms using Google Document AI / Ekstraksi dokumen khusus",
    {
      base64Image: z.string().describe("書類画像データ(Base64)"),
      mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]).describe("書類のMIMEタイプ"),
      extractorType: z.enum(["standard_visa_form", "tax_certificate", "contract"]).default("standard_visa_form")
        .describe("呼び出すCustom Extractorのタイプ"),
    },
    { readOnlyHint: true },
    async ({ base64Image, mimeType, extractorType }) => {
      try {
        const projectId = process.env.GCP_PROJECT_ID || "mcp-service-492010";
        const location = "asia-northeast1";
        
        // 環境変数からのプロセッサID解決（学習済みのモデルを使う前提の実装）
        const processorIdMap: Record<string, string | undefined> = {
            "standard_visa_form": process.env.DOCAI_ISA_FORM_EXTRACTOR_ID,
            "tax_certificate": process.env.DOCAI_TAX_CERT_EXTRACTOR_ID,
            "contract": process.env.DOCAI_CONTRACT_EXTRACTOR_ID,
        };

        const processorId = processorIdMap[extractorType];

        if (!processorId) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "warning",
                        message: `The specific processor for '${extractorType}' is not configured yet. Fallback to Gemini parsing recommended. Configure DOCAI_XXX_EXTRACTOR_ID in .env.`,
                    }),
                }],
            };
        }

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const request = {
          name,
          rawDocument: {
            content: base64Image,
            mimeType: mimeType,
          },
        };

        const [result] = await client.processDocument(request);
        const { document } = result;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              extracted_text: document?.text?.substring(0, 500) + "...(truncated)", // Simplify output for MCP
              entities: document?.entities?.map(e => ({ type: e.type, mentionText: e.mentionText })),
              _ai_recommendation: "抽出されたエンティティをSuguVisaのJSONスキーマに直接マッピングし、乖離がないか検証してください。"
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
