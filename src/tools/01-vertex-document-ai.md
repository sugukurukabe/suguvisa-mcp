# 指示書①: Vertex AI Document AI — 在留カードOCR精度強化

## 概要
## Overview
## Ikhtisar

suguvisa-mcpの`parse-residence-card.ts`にVertex AI Document AIを統合し、
在留カードのOCR精度を現在の正規表現ベース → Google Document AI ベースに強化する。

GCPプロジェクト: `sugukurucorpsite`
リージョン: `asia-northeast1`（東京）

---

## Step 1: 依存関係の追加

package.jsonに以下を追加:

```json
{
  "dependencies": {
    "@google-cloud/documentai": "^8.0.0"
  }
}
```

```bash
npm install @google-cloud/documentai
```

---

## Step 2: Document AIプロセッサの設定ユーティリティ

### ファイル: `src/lib/document-ai.ts`

```typescript
// Vertex AI Document AIクライアント
// Vertex AI Document AI client
// Klien Vertex AI Document AI
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";

// プロセッサの設定
// Processor configuration
// Konfigurasi prosesor
const PROCESSOR_CONFIG = {
  projectId: process.env.GCP_PROJECT_ID || "sugukurucorpsite",
  location: "asia-northeast1",
  // IDドキュメントパーサー（在留カード・パスポート対応）
  // ID Document Parser (supports residence cards and passports)
  // Parser Dokumen ID (mendukung kartu izin tinggal dan paspor)
  idParserProcessorId: process.env.DOCUMENT_AI_ID_PARSER_ID || "",
  // 汎用OCRプロセッサ（フォールバック用）
  // General OCR processor (fallback)
  // Prosesor OCR umum (cadangan)
  ocrProcessorId: process.env.DOCUMENT_AI_OCR_PROCESSOR_ID || "",
};

const client = new DocumentProcessorServiceClient();

/**
 * Document AIでドキュメントを処理する
 * Process a document with Document AI
 * Memproses dokumen dengan Document AI
 *
 * @param imageBuffer - 画像データ / Image data / Data gambar
 * @param mimeType - MIME type (image/jpeg, image/png)
 * @param processorType - プロセッサタイプ / Processor type / Tipe prosesor
 */
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
  // Send request to Document AI
  // Mengirim permintaan ke Document AI
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
  // Extract entities (for ID parser)
  // Ekstraksi entitas (untuk parser ID)
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
  };
}

export interface DocumentAIResult {
  fullText: string;
  entities: Record<string, string>;
  confidence: number;
  pageCount: number;
}
```

---

## Step 3: parse-residence-card.ts の書き直し

### ファイル: `src/tools/parse-residence-card.ts`

既存のファイルを以下で完全に置き換える:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { processDocument, type DocumentAIResult } from "../lib/document-ai.js";

/**
 * 在留カードの読み取り結果を構造化データに変換する
 * Convert residence card reading results to structured data
 * Mengonversi hasil pembacaan kartu izin tinggal menjadi data terstruktur
 */
export function registerParseResidenceCard(server: McpServer) {
  server.tool(
    "parse_residence_card",
    "在留カードの画像またはOCRテキストを構造化データに変換・検証する。Vertex AI Document AIで高精度OCRを実行。画像はサーバーに保存しない。Mengonversi gambar atau teks OCR kartu izin tinggal menjadi data terstruktur.",
    {
      // 2つの入力方式をサポート
      // Support two input methods
      // Mendukung dua metode input
      image_base64: z.string().optional().describe(
        "在留カード画像のBase64エンコードデータ（表面）。Claude Visionから渡される場合はこちら / Base64 encoded image data of residence card (front side) / Data gambar kartu izin tinggal yang dienkode Base64 (sisi depan)"
      ),
      image_mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).optional().describe(
        "画像のMIMEタイプ / Image MIME type / Tipe MIME gambar"
      ),
      ocr_text: z.string().optional().describe(
        "Claude VisionがOCRで読み取ったテキスト（Document AIが使えない場合のフォールバック） / OCR text from Claude Vision (fallback) / Teks OCR dari Claude Vision (cadangan)"
      ),
    },
    async ({ image_base64, image_mime_type, ocr_text }) => {
      let parsed: ParsedResidenceCard;

      if (image_base64 && image_mime_type) {
        // === Document AIによる高精度OCR ===
        // === High-accuracy OCR with Document AI ===
        // === OCR presisi tinggi dengan Document AI ===
        try {
          const imageBuffer = Buffer.from(image_base64, "base64");
          const aiResult = await processDocument(imageBuffer, image_mime_type, "id_parser");
          parsed = mapDocumentAIResult(aiResult);
          parsed._method = "document_ai";
          parsed._confidence = aiResult.confidence;
        } catch (err: any) {
          // Document AIが失敗した場合、正規表現にフォールバック
          // Fallback to regex if Document AI fails
          // Fallback ke regex jika Document AI gagal
          console.error("Document AI failed, falling back to regex:", err.message);
          if (ocr_text) {
            parsed = parseWithRegex(ocr_text);
            parsed._method = "regex_fallback";
          } else {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  error: "Document AI processing failed and no OCR text was provided as fallback",
                  detail: err.message,
                  suggestion: "在留カードのテキストを手動で入力するか、Claude Visionで読み取ったテキストをocr_textに渡してください",
                }, null, 2),
              }],
            };
          }
        }
      } else if (ocr_text) {
        // === 正規表現ベースのパース（フォールバック）===
        // === Regex-based parsing (fallback) ===
        // === Parsing berbasis regex (cadangan) ===
        parsed = parseWithRegex(ocr_text);
        parsed._method = "regex";
      } else {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "image_base64 または ocr_text のどちらかを提供してください",
              error_en: "Please provide either image_base64 or ocr_text",
              error_id: "Harap berikan image_base64 atau ocr_text",
            }, null, 2),
          }],
        };
      }

      // バリデーション
      // Validation
      // Validasi
      const validationErrors = validateParsedData(parsed);

      // 読み取り結果のサマリー
      // Summary of parsed results
      // Ringkasan hasil parsing
      const filledFields = Object.entries(parsed)
        .filter(([k, v]) => !k.startsWith("_") && v !== null && v !== "")
        .length;
      const totalFields = Object.keys(parsed)
        .filter((k) => !k.startsWith("_"))
        .length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            parsed,
            extraction_method: parsed._method,
            confidence: parsed._confidence || null,
            fields_extracted: `${filledFields}/${totalFields}`,
            validation_errors: validationErrors,
            needs_confirmation: true,
            message: "以下の情報を在留カードから読み取りました。正しいか確認してください。",
            message_en: "The following information was extracted from the residence card. Please confirm it is correct.",
            message_id: "Informasi berikut telah dibaca dari kartu izin tinggal. Silakan konfirmasi kebenarannya.",
            warning: "⚠️ 画像はサーバーに保存されません。処理後に即座に破棄されます。",
            warning_en: "⚠️ Images are not stored on the server. They are discarded immediately after processing.",
            warning_id: "⚠️ Gambar tidak disimpan di server. Gambar langsung dihapus setelah diproses.",
          }, null, 2),
        }],
      };
    }
  );
}

// === Document AIの結果をマッピング ===
// === Map Document AI results ===
// === Memetakan hasil Document AI ===
function mapDocumentAIResult(result: DocumentAIResult): ParsedResidenceCard {
  const e = result.entities;
  return {
    name_romaji: e["full_name"] || e["given_name"] && e["family_name"]
      ? `${e["family_name"] || ""} ${e["given_name"] || ""}`.trim()
      : null,
    date_of_birth: normalizeDate(e["date_of_birth"] || null),
    gender: e["gender"] || null,
    nationality: e["nationality"] || e["issuing_country"] || null,
    visa_type: e["document_type"] || extractVisaType(result.fullText),
    visa_expiry: normalizeDate(e["expiry_date"] || e["expiration_date"] || null),
    residence_card_number: e["document_id"] || e["id_number"] || extractCardNumber(result.fullText),
    address: e["address"] || null,
    work_restriction: extractWorkRestriction(result.fullText),
    _method: "document_ai",
    _confidence: result.confidence,
  };
}

// === 正規表現ベースのパース（フォールバック）===
// === Regex-based parsing (fallback) ===
// === Parsing berbasis regex (cadangan) ===
function parseWithRegex(ocrText: string): ParsedResidenceCard {
  const lines = ocrText.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed: ParsedResidenceCard = {
    name_romaji: null,
    date_of_birth: null,
    gender: null,
    nationality: null,
    visa_type: null,
    visa_expiry: null,
    residence_card_number: null,
    address: null,
    work_restriction: null,
    _method: "regex",
  };

  for (const line of lines) {
    // 在留資格
    if (/在留資格|Status of Residence/i.test(line)) {
      parsed.visa_type = line.replace(/.*[:：]/, "").trim();
    }
    // 在留期限
    if (/在留期間.*満了日|Date of Expiration|Period of Stay/i.test(line)) {
      parsed.visa_expiry = normalizeDate(line);
    }
    // 国籍
    if (/国籍.*地域|Nationality/i.test(line)) {
      parsed.nationality = line.replace(/.*[:：]/, "").trim();
    }
    // 氏名（ローマ字 — 大文字のみの行）
    if (/^[A-Z][A-Z\s]+[A-Z]$/.test(line) && !parsed.name_romaji) {
      parsed.name_romaji = line;
    }
    // 在留カード番号
    const cardMatch = line.match(/[A-Z]{2}\d{8}[A-Z0-9]{2}/);
    if (cardMatch) {
      parsed.residence_card_number = cardMatch[0];
    }
    // 性別
    if (/性別|Sex/i.test(line)) {
      if (/男|Male/i.test(line)) parsed.gender = "男";
      else if (/女|Female/i.test(line)) parsed.gender = "女";
    }
    // 生年月日
    const dobMatch = line.match(/(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
    if (dobMatch && !parsed.date_of_birth && /生年月日|Date of Birth/i.test(line)) {
      parsed.date_of_birth = `${dobMatch[1]}-${dobMatch[2].padStart(2, "0")}-${dobMatch[3].padStart(2, "0")}`;
    }
    // 就労制限
    if (/就労制限|Permission to engage/i.test(line)) {
      parsed.work_restriction = line.replace(/.*[:：]/, "").trim();
    }
  }

  return parsed;
}

// === ユーティリティ関数 ===
// === Utility functions ===
// === Fungsi utilitas ===

function normalizeDate(text: string | null): string | null {
  if (!text) return null;
  // 和暦対応（令和、平成）
  // Support Japanese era (Reiwa, Heisei)
  // Mendukung era Jepang (Reiwa, Heisei)
  const eraMatch = text.match(/(令和|平成|昭和)(\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const eraOffsets: Record<string, number> = { "令和": 2018, "平成": 1988, "昭和": 1925 };
    const year = eraOffsets[eraMatch[1]] + parseInt(eraMatch[2]);
    return `${year}-${eraMatch[3].padStart(2, "0")}-${eraMatch[4].padStart(2, "0")}`;
  }
  // 西暦
  const westernMatch = text.match(/(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})/);
  if (westernMatch) {
    return `${westernMatch[1]}-${westernMatch[2].padStart(2, "0")}-${westernMatch[3].padStart(2, "0")}`;
  }
  return null;
}

function extractVisaType(text: string): string | null {
  const visaPatterns = [
    "特定技能1号", "特定技能２号", "技能実習1号", "技能実習2号", "技能実習3号",
    "留学", "特定活動", "技術・人文知識・国際業務", "永住者", "定住者",
  ];
  for (const pattern of visaPatterns) {
    if (text.includes(pattern)) return pattern;
  }
  return null;
}

function extractCardNumber(text: string): string | null {
  const match = text.match(/[A-Z]{2}\d{8}[A-Z0-9]{2}/);
  return match ? match[0] : null;
}

function extractWorkRestriction(text: string): string | null {
  if (/就労不可|No work permitted/i.test(text)) return "就労不可";
  if (/就労制限なし|No restriction/i.test(text)) return "就労制限なし";
  if (/指定書.*記載.*活動|designated activities/i.test(text)) return "指定書記載の活動";
  return null;
}

function validateParsedData(parsed: ParsedResidenceCard): string[] {
  const errors: string[] = [];
  if (parsed.residence_card_number && !/^[A-Z]{2}\d{8}[A-Z0-9]{2}$/.test(parsed.residence_card_number)) {
    errors.push("在留カード番号の形式が不正です（正しい形式: AB12345678CD）");
  }
  if (parsed.visa_expiry) {
    const expiry = new Date(parsed.visa_expiry);
    if (isNaN(expiry.getTime())) {
      errors.push("在留期限の日付形式が不正です");
    }
  }
  if (parsed.date_of_birth) {
    const dob = new Date(parsed.date_of_birth);
    if (isNaN(dob.getTime())) {
      errors.push("生年月日の日付形式が不正です");
    }
  }
  return errors;
}

interface ParsedResidenceCard {
  name_romaji: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  visa_type: string | null;
  visa_expiry: string | null;
  residence_card_number: string | null;
  address: string | null;
  work_restriction: string | null;
  _method?: string;
  _confidence?: number;
}
```

---

## Step 4: 環境変数

`.env` に追加（値は壁が別途提供）:

```
# Vertex AI Document AI
GCP_PROJECT_ID=sugukurucorpsite
DOCUMENT_AI_ID_PARSER_ID=（壁がGCPコンソールで作成後に提供）
DOCUMENT_AI_OCR_PROCESSOR_ID=（同上）
GOOGLE_APPLICATION_CREDENTIALS=gcs-key.json
```

---

## Step 5: GCPコンソールでプロセッサを作成する手順（壁が実行）

1. console.cloud.google.com → Document AI を開く
2. 「プロセッサを作成」→ 「ID Document Parser」を選択
3. リージョン: asia-northeast1
4. 名前: suguvisa-id-parser
5. 作成 → プロセッサIDをコピー → .envのDOCUMENT_AI_ID_PARSER_IDに設定
6. 同様に「General OCR」プロセッサも作成 → DOCUMENT_AI_OCR_PROCESSOR_IDに設定

---

## Step 6: テスト

### ファイル: `src/tools/__tests__/parse-residence-card.test.ts`

以下のテストケースを作成:

```typescript
// 1. Document AIの結果マッピングが正しいか
// 2. 正規表現フォールバックが動作するか
// 3. 和暦（令和5年）→ 西暦（2023年）の変換
// 4. 在留カード番号のバリデーション
// 5. Document AI失敗時のフォールバック動作
// 6. 画像もOCRテキストもない場合のエラー
```

---

## 料金

- Document AI ID Parser: $0.01/ページ（月1000ページまで無料）
- suguvisa-mcpの想定使用量: 月50〜200ページ → 月$0.50〜$2.00
- 実質無料レベル

---

## セキュリティ

- 画像データはDocument AIに送信されるが、Googleは処理後にデータを保持しない
- suguvisa-mcpサーバー上にも画像を保存しない
- APIリクエスト完了後、imageBufferはGCで即座に破棄される
