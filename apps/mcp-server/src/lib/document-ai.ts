import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

// プロセッサの設定
const PROCESSOR_CONFIG = {
  projectId: process.env.GCP_PROJECT_ID || "mcp-service-492010",
  location: process.env.DOCUMENT_AI_LOCATION || "us",
  // IDドキュメントパーサー（在留カード・パスポート対応）
  idParserProcessorId: process.env.DOCUMENT_AI_ID_PARSER_ID,
  // 汎用OCRプロセッサ（フォールバック用）
  ocrProcessorId: process.env.DOCUMENT_AI_OCR_PROCESSOR_ID,
};

const client = new DocumentProcessorServiceClient();

export async function processDocument(
  imageBuffer: Buffer,
  mimeType: string,
  processorType: "id_parser" | "ocr" = "id_parser"
): Promise<DocumentAIResult> {
  const processorId =
    processorType === "id_parser"
      ? PROCESSOR_CONFIG.idParserProcessorId
      : PROCESSOR_CONFIG.ocrProcessorId;

  if (!processorId) {
    throw new Error(
      `Document AI processor ID is not configured. Set DOCUMENT_AI_${processorType.toUpperCase()}_ID in .env`
    );
  }

  const processorName = `projects/${PROCESSOR_CONFIG.projectId}/locations/${PROCESSOR_CONFIG.location}/processors/${processorId}`;

  // Document AIにリクエスト送信
  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: imageBuffer.toString("base64"),
      mimeType,
    },
  });

  const { document } = result;
  if (!document || !document.text) {
    throw new Error("Document AI returned empty result");
  }

  // エンティティの抽出（IDパーサーの場合）
  const entities: Record<string, string> = {};
  if (document.entities) {
    for (const entity of document.entities) {
      if (entity.type && entity.mentionText) {
        entities[entity.type] = entity.mentionText;
      }
    }
  }

  return {
    fullText: document.text,
    entities,
    confidence: document.entities?.[0]?.confidence || 0,
    pageCount: document.pages?.length || 0,
    dataHandling: {
      imageStoredBySuguVisa: false,
      rawImageRetention: "not_persisted_by_application",
    },
  };
}

export interface DocumentAIResult {
  fullText: string;
  entities: Record<string, string>;
  confidence: number;
  pageCount: number;
  dataHandling: {
    imageStoredBySuguVisa: false;
    rawImageRetention: "not_persisted_by_application";
  };
}
