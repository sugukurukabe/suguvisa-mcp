/**
 * Vertex AI Gemini クライアント
 * 申請理由書AI生成・書類レビュー・ナレッジベース検索に使用
 */
import { VertexAI, GenerativeModel, HarmCategory, HarmBlockThreshold, Part } from "@google-cloud/vertexai";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "mcp-service-492010";
const LOCATION = process.env.VERTEX_AI_LOCATION || "us-central1";

let vertexAI: VertexAI | null = null;
let geminiModel: GenerativeModel | null = null;
let geminiFlashModel: GenerativeModel | null = null;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  }
  return vertexAI;
}

/**
 * Gemini Pro モデルを取得（高精度タスク: 理由書生成、書類レビュー）
 */
export function getGeminiModel(): GenerativeModel {
  if (!geminiModel) {
    geminiModel = getVertexAI().getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      generationConfig: {
        temperature: 0.3,  // 法務文書は正確性重視
        topP: 0.8,
        maxOutputTokens: 4096,
      },
    });
  }
  return geminiModel;
}

/**
 * Gemini Flash モデルを取得（高速タスク: バリデーション、軽量分析）
 */
export function getGeminiFlashModel(): GenerativeModel {
  if (!geminiFlashModel) {
    geminiFlashModel = getVertexAI().getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });
  }
  return geminiFlashModel;
}

/**
 * テキストのみの生成
 */
export async function generateText(prompt: string, useFlash = false): Promise<string> {
  const model = useFlash ? getGeminiFlashModel() : getGeminiModel();
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * マルチモーダル生成（画像 + テキスト）
 */
export async function generateWithImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const model = getGeminiModel();
  const imagePart: Part = {
    inlineData: {
      data: imageBase64,
      mimeType,
    },
  };
  const textPart: Part = { text: prompt };
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [textPart, imagePart] }],
  });
  const response = result.response;
  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Vertex AI が利用可能かチェック
 */
export function isVertexAIAvailable(): boolean {
  try {
    getVertexAI();
    return true;
  } catch {
    return false;
  }
}

export { PROJECT_ID, LOCATION };
