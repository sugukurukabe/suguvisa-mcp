/**
 * Vertex AI Gemini クライアント（@google/genai SDK版）
 * 申請理由書AI生成・書類レビュー・ナレッジベース検索に使用
 */
import { GoogleGenAI, Type } from "@google/genai";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "mcp-service-492010";
const LOCATION = process.env.VERTEX_AI_LOCATION || "us-central1";
const MODEL_ID = process.env.VERTEX_AI_MODEL || "gemini-2.5-pro";
const FLASH_MODEL_ID = process.env.VERTEX_AI_FLASH_MODEL || "gemini-2.5-flash";

let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAI) {
    genAI = new GoogleGenAI({
      vertexai: true,
      project: PROJECT_ID,
      location: LOCATION,
    });
  }
  return genAI;
}

/**
 * テキストのみの生成
 */
export async function generateText(prompt: string, useFlash = false): Promise<string> {
  const ai = getGenAI();
  const result = await ai.models.generateContent({
    model: useFlash ? FLASH_MODEL_ID : MODEL_ID,
    contents: prompt,
    config: {
      temperature: 0.3,  // 法務文書は正確性重視
      topP: 0.8,
      maxOutputTokens: 4096,
    },
  });
  return result.text || "";
}

/**
 * マルチモーダル生成（画像 + テキスト）
 */
export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const ai = getGenAI();
  const result = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBase64,
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });
  return result.text || "";
}

/**
 * Vertex AI が利用可能かチェック
 */
export function isVertexAIAvailable(): boolean {
  try {
    getGenAI();
    return true;
  } catch {
    return false;
  }
}

export { PROJECT_ID, LOCATION };
