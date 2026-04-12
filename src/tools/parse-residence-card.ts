import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { processDocument, type DocumentAIResult } from "../lib/document-ai.js";

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

export async function parseResidenceCardHandler({
  image_base64,
  image_mime_type,
  ocr_text
}: {
  image_base64?: string;
  image_mime_type?: "image/jpeg" | "image/png" | "image/webp";
  ocr_text?: string;
}) {
  let parsed: ParsedResidenceCard;

  if (image_base64 && image_mime_type) {
    // === Document AIによる高精度OCR ===
    try {
      const imageBuffer = Buffer.from(image_base64, "base64");
      const aiResult = await processDocument(imageBuffer, image_mime_type, "id_parser");
      parsed = mapDocumentAIResult(aiResult);
      parsed._method = "document_ai";
      parsed._confidence = aiResult.confidence;
    } catch (err: any) {
      // Document AIが失敗した場合、正規表現にフォールバック
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
    parsed = parseWithRegex(ocr_text);
    parsed._method = "regex";
  } else {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          error: "image_base64 または ocr_text のどちらかを提供してください",
        }, null, 2),
      }],
    };
  }

  // バリデーション
  const validationErrors = validateParsedData(parsed);

  const filledFields = Object.entries(parsed)
    .filter(([k, v]) => !k.startsWith("_") && v !== null && v !== "")
    .length;
  const totalFields = Object.keys(parsed)
    .filter((k) => !k.startsWith("_"))
    .length;

  // ── 申請用データへの自動変換 ──
  const { resolveNationalityCode, splitRomajiName } = await import("../data/csv-schema.js");

  const forApplication: Record<string, string | null> = {};

  // 性別コード変換: 男→1, 女→2
  if (parsed.gender) {
    if (/男|Male/i.test(parsed.gender)) forApplication.sex = "1";
    else if (/女|Female/i.test(parsed.gender)) forApplication.sex = "2";
    else forApplication.sex = parsed.gender;
  }

  // 国籍コード変換: インドネシア→IDN
  if (parsed.nationality) {
    forApplication.nationality_code = resolveNationalityCode(parsed.nationality);
  }

  // 氏名分割: GILANG PERMANA → family/given
  if (parsed.name_romaji) {
    const { family, given } = splitRomajiName(parsed.name_romaji);
    forApplication.family_name_romaji = family;
    forApplication.given_name_romaji = given;
  }

  // 生年月日: YYYYMMDD形式
  if (parsed.date_of_birth) {
    forApplication.date_of_birth = parsed.date_of_birth.replace(/-/g, "");
  }

  // 在留カード番号
  if (parsed.residence_card_number) {
    forApplication.residence_card_number = parsed.residence_card_number;
  }

  // 在留期限: YYYYMMDD形式
  if (parsed.visa_expiry) {
    forApplication.visa_expiry_date = parsed.visa_expiry.replace(/-/g, "");
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        parsed,
        for_application: forApplication,
        extraction_method: parsed._method,
        confidence: parsed._confidence || null,
        fields_extracted: `${filledFields}/${totalFields}`,
        validation_errors: validationErrors,
        needs_confirmation: true,
        message: "以下の情報を在留カードから読み取りました。正しいか確認してください。",
        warning: "⚠️ 画像はサーバーに保存されません。処理後に即座に破棄されます。",
        _ai_instructions:
          "📋 読み取り結果を表形式で表示してください。\n" +
          "for_application の値は申請書類に直接使えるコードに変換済みです。\n" +
          "ユーザーに内容を確認してもらい、OKなら determine_application_type に進んでください。\n" +
          "⚠️ 旅券番号は在留カードに記載されていないため、別途パスポートから取得が必要です。\n" +
          "\n🚨 【特定活動の在留カードを読み取った場合の重要ルール】\n" +
          "在留資格が「特定活動」の場合、以下を絶対に守ってください：\n" +
          "- ❌「これはどの種類の特定活動ですか？」と聞かない\n" +
          "- ❌「46号ですか？」「ワーホリですか？」と聞かない\n" +
          "- ❌「アルバイト系の可能性があります」と言わない\n" +
          "- ❌ 就労制限欄を誤読して「就労制限なし」と判断しない\n" +
          "- ✅ 就労制限欄に「指定された活動のみ可」「特定技能により〜」とあれば、\n" +
          "  これは100% 特定技能1号準備のつなぎビザです\n" +
          "- ✅ 即座に「特定活動→特定技能1号の変更申請ですね」と確定\n" +
          "- ✅ determine_application_type(from_visa: '特定活動', to_visa: '特定技能1号') へ進む\n" +
          "- ✅ 転職（別の会社で特定技能をやる）の場合は context: '転職' を追加",
      }, null, 2),
    }],
  };
}

/**
 * 在留カードの読み取り結果を構造化データに変換する
 */
export function registerParseResidenceCard(server: McpServer) {
  server.tool(
    "parse_residence_card",
    "【在留カードOCR】在留カードの画像またはOCRテキストから、氏名・国籍・在留資格・在留期限・カード番号等を構造化データに変換。Google Vertex AI Document AIによる高精度OCRと、正規表現フォールバックの二段構え。画像データはサーバーに一切保存しません。 / Extracts structured data from residence card images using Vertex AI Document AI with regex fallback. Images are never stored.",
    {
      image_base64: z.string().optional().describe(
        "在留カード画像のBase64エンコードデータ（表面）。"
      ),
      image_mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).optional().describe(
        "画像のMIMEタイプ"
      ),
      ocr_text: z.string().optional().describe(
        "Claude VisionがOCRで読み取ったテキスト（Document AIが使えない場合のフォールバック）"
      ),
    },
    async (args) => await parseResidenceCardHandler(args as any)
  );
}

// === Document AIの結果をマッピング ===
function mapDocumentAIResult(result: DocumentAIResult): ParsedResidenceCard {
  const e = result.entities;
  return {
    name_romaji: e["full_name"] || (e["given_name"] && e["family_name"] ? `${e["family_name"] || ""} ${e["given_name"] || ""}`.trim() : null),
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
    if (/在留資格|Status of Residence/i.test(line)) {
      parsed.visa_type = line.replace(/.*[:：]/, "").trim();
    }
    if (/在留期間.*満了日|Date of Expiration|Period of Stay/i.test(line)) {
      parsed.visa_expiry = normalizeDate(line);
    }
    if (/国籍.*地域|Nationality/i.test(line)) {
      parsed.nationality = line.replace(/.*[:：]/, "").trim();
    }
    if (/^[A-Z][A-Z\s]+[A-Z]$/.test(line) && !parsed.name_romaji) {
      parsed.name_romaji = line;
    }
    const cardMatch = line.match(/[A-Z]{2}\d{8}[A-Z0-9]{2}/);
    if (cardMatch) {
      parsed.residence_card_number = cardMatch[0];
    }
    if (/性別|Sex/i.test(line)) {
      if (/男|Male/i.test(line)) parsed.gender = "男";
      else if (/女|Female/i.test(line)) parsed.gender = "女";
    }
    if (/国籍・地域|Nationality/i.test(line)) {
      parsed.nationality = line.replace(/国籍・地域|Nationality\/Region|Nationality/ig, "").trim();
    }
    if (/在留資格|Status of Residence/i.test(line)) {
      parsed.visa_type = line.replace(/在留資格|Status of Residence/ig, "").trim();
    }
    if (/就労制限|Permission to engage/i.test(line)) {
      parsed.work_restriction = line.replace(/就労制限|Permission to engage/ig, "").replace(/.*[:：]/, "").trim();
    }
    if (/生年月日|Date of Birth/i.test(line) && !parsed.date_of_birth) {
      parsed.date_of_birth = normalizeDate(line);
    }
  }

  return parsed;
}

// === ユーティリティ関数 ===
function normalizeDate(text: string | null): string | null {
  if (!text) return null;
  const eraMatch = text.match(/(令和|平成|昭和)(\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const eraOffsets: Record<string, number> = { "令和": 2018, "平成": 1988, "昭和": 1925 };
    const year = eraOffsets[eraMatch[1]] + parseInt(eraMatch[2]);
    return `${year}-${eraMatch[3].padStart(2, "0")}-${eraMatch[4].padStart(2, "0")}`;
  }
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
