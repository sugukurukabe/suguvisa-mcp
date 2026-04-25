import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { processDocument } from "../lib/document-ai.js";
import { generateWithImage } from "../lib/vertex-ai.js";

interface ParsedPassport {
  full_name: string | null;
  family_name: string | null;
  given_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  passport_number: string | null;
  expiry_date: string | null;
  issuing_country: string | null;
  mrz_line1: string | null;
  mrz_line2: string | null;
  _method?: string;
  _confidence?: number;
}

/**
 * パスポートOCR — Document AI + Gemini Vision のハイブリッド
 */
export function registerParsePassport(server: McpServer) {
  server.tool(
    "suguvisa_passport_parse",
    "【パスポートOCR】パスポート画像からAIで自動読み取り。氏名（姓名分割）・生年月日・性別・国籍・旅券番号・有効期限・MRZを抽出。Document AI → Gemini Vision → 正規表現の3段フォールバック。画像はサーバーに保存しません。 / Extract passport data (name, DOB, gender, nationality, passport number, expiry, MRZ) from images using Document AI + Gemini Vision hybrid OCR.",
    {
      image_base64: z.string().optional().describe(
        "パスポート画像のBase64エンコードデータ（顔写真ページ）。Claude/GPTがユーザーの画像を読み取って渡す / Base64 encoded passport image (bio page)"
      ),
      image_mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]).optional().describe(
        "画像のMIMEタイプ / Image MIME type"
      ),
      ocr_text: z.string().optional().describe(
        "AIが読み取ったOCRテキスト（画像がない場合のフォールバック） / OCR text fallback"
      ),
    },
    { title: "Parse passport (OCR)", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ image_base64, image_mime_type, ocr_text }) => {
      let parsed: ParsedPassport;

      if (image_base64 && image_mime_type) {
        // === Stage 1: Document AI ===
        try {
          const imageBuffer = Buffer.from(image_base64, "base64");
          const aiResult = await processDocument(imageBuffer, image_mime_type, "id_parser");
          parsed = mapDocumentAIPassport(aiResult);
          parsed._method = "document_ai";
          parsed._confidence = aiResult.confidence;
        } catch (docAiErr: any) {
          console.warn("Document AI failed for passport, trying Gemini Vision:", docAiErr.message);
          
          // === Stage 2: Gemini Vision（フォールバック）===
          try {
            parsed = await parseWithGeminiVision(image_base64, image_mime_type);
            parsed._method = "gemini_vision";
          } catch (geminiErr: any) {
            console.warn("Gemini Vision failed, trying regex:", geminiErr.message);
            
            // === Stage 3: 正規表現（最終フォールバック）===
            if (ocr_text) {
              parsed = parsePassportWithRegex(ocr_text);
              parsed._method = "regex_fallback";
            } else {
              return {
                content: [{
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "パスポートの読み取りに失敗しました",
                    detail: `Document AI: ${docAiErr.message}, Gemini: ${geminiErr.message}`,
                    suggestion: "パスポートのテキストを手動で ocr_text に入力してください",
                  }, null, 2),
                }],
              };
            }
          }
        }
      } else if (ocr_text) {
        parsed = parsePassportWithRegex(ocr_text);
        parsed._method = "regex";
      } else {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "image_base64 または ocr_text のどちらかを提供してください",
              _ai_instructions: "ユーザーにパスポートの写真を送るよう案内してください",
            }, null, 2),
          }],
        };
      }

      // バリデーション
      const errors = validatePassport(parsed);
      const filledFields = Object.entries(parsed)
        .filter(([k, v]) => !k.startsWith("_") && v !== null && v !== "").length;
      const totalFields = Object.keys(parsed)
        .filter(k => !k.startsWith("_")).length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            parsed,
            extraction_method: parsed._method,
            confidence: parsed._confidence || null,
            fields_extracted: `${filledFields}/${totalFields}`,
            validation_errors: errors,
            needs_confirmation: true,
            message: "以下の情報をパスポートから読み取りました。正しいか確認してください。",
            warning: "⚠️ 画像はサーバーに保存されません。処理後に即座に破棄されます。",
            _ai_instructions: "読み取り結果をユーザーに見やすく表示し、間違いがないか確認を取ってください。特に旅券番号と有効期限は重要です。",
          }, null, 2),
        }],
      };
    }
  );
}

// === Gemini Visionでパスポート読み取り ===
async function parseWithGeminiVision(imageBase64: string, mimeType: string): Promise<ParsedPassport> {
  const prompt = `この画像はパスポートの顔写真ページです。以下の情報をJSON形式で抽出してください。
読み取れない項目はnullにしてください。

{
  "full_name": "フルネーム（ローマ字）",
  "family_name": "姓（ローマ字）",
  "given_name": "名（ローマ字）",
  "date_of_birth": "YYYY-MM-DD形式",
  "gender": "M or F",
  "nationality": "国名（英語）",
  "passport_number": "旅券番号",
  "expiry_date": "YYYY-MM-DD形式",
  "issuing_country": "発行国（英語）",
  "mrz_line1": "MRZ1行目（44文字）",
  "mrz_line2": "MRZ2行目（44文字）"
}

重要: JSONのみを出力し、説明文は不要です。`;

  const response = await generateWithImage(prompt, imageBase64, mimeType);
  
  // JSON部分を抽出
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON");
  
  const data = JSON.parse(jsonMatch[0]);
  return {
    full_name: data.full_name || null,
    family_name: data.family_name || null,
    given_name: data.given_name || null,
    date_of_birth: data.date_of_birth || null,
    gender: data.gender || null,
    nationality: data.nationality || null,
    passport_number: data.passport_number || null,
    expiry_date: data.expiry_date || null,
    issuing_country: data.issuing_country || null,
    mrz_line1: data.mrz_line1 || null,
    mrz_line2: data.mrz_line2 || null,
    _confidence: 0.85,
  };
}

// === Document AI結果マッピング ===
function mapDocumentAIPassport(result: any): ParsedPassport {
  const e = result.entities || {};
  return {
    full_name: e["full_name"] || (e["family_name"] && e["given_name"]
      ? `${e["family_name"]} ${e["given_name"]}` : null),
    family_name: e["family_name"] || null,
    given_name: e["given_name"] || null,
    date_of_birth: e["date_of_birth"] || null,
    gender: e["gender"] || null,
    nationality: e["nationality"] || e["issuing_country"] || null,
    passport_number: e["document_id"] || e["id_number"] || null,
    expiry_date: e["expiry_date"] || e["expiration_date"] || null,
    issuing_country: e["issuing_country"] || null,
    mrz_line1: e["mrz_line1"] || extractMRZFromText(result.fullText)?.[0] || null,
    mrz_line2: e["mrz_line2"] || extractMRZFromText(result.fullText)?.[1] || null,
  };
}

// === 正規表現パーサー ===
function parsePassportWithRegex(text: string): ParsedPassport {
  const parsed: ParsedPassport = {
    full_name: null, family_name: null, given_name: null,
    date_of_birth: null, gender: null, nationality: null,
    passport_number: null, expiry_date: null, issuing_country: null,
    mrz_line1: null, mrz_line2: null,
  };

  // MRZ抽出（最も信頼性が高い）
  const mrzLines = extractMRZFromText(text);
  if (mrzLines) {
    parsed.mrz_line1 = mrzLines[0];
    parsed.mrz_line2 = mrzLines[1];
    // MRZから情報をデコード
    const mrzData = decodeMRZ(mrzLines[0], mrzLines[1]);
    Object.assign(parsed, mrzData);
  }

  // テキストベースの補完
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // 旅券番号
    const passportMatch = line.match(/[A-Z]{1,2}\d{7,8}/);
    if (passportMatch && !parsed.passport_number) {
      parsed.passport_number = passportMatch[0];
    }
    // 氏名（大文字ローマ字の行）
    if (/^[A-Z][A-Z\s]+[A-Z]$/.test(line) && !parsed.full_name && line.length > 3) {
      parsed.full_name = line;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        parsed.family_name = parts[0];
        parsed.given_name = parts.slice(1).join(" ");
      }
    }
    // 国籍
    if (/nationality|国籍/i.test(line)) {
      const val = line.replace(/.*[:：]/,"").trim();
      if (val) parsed.nationality = val;
    }
  }

  return parsed;
}

// === MRZ抽出 ===
function extractMRZFromText(text: string): [string, string] | null {
  // MRZは44文字の2行（TD3形式 = パスポート）
  const mrzPattern = /([A-Z0-9<]{44})\s*\n?\s*([A-Z0-9<]{44})/;
  const match = text.match(mrzPattern);
  if (match) return [match[1], match[2]];
  return null;
}

// === MRZデコード ===
function decodeMRZ(line1: string, line2: string): Partial<ParsedPassport> {
  const result: Partial<ParsedPassport> = {};
  
  // Line 1: P<JPNSUZUKI<<TARO<<<<<<<<<<<<<<<<<<<<<<<<<<
  if (line1.startsWith("P")) {
    const issuingCountry = line1.substring(2, 5).replace(/</g, "");
    result.issuing_country = issuingCountry;
    
    const namePart = line1.substring(5).replace(/<+$/, "");
    const [family, ...given] = namePart.split("<<");
    result.family_name = family?.replace(/</g, " ").trim() || null;
    result.given_name = given.join(" ").replace(/</g, " ").trim() || null;
    if (result.family_name && result.given_name) {
      result.full_name = `${result.family_name} ${result.given_name}`;
    }
  }

  // Line 2: AB12345676JPN9001018M3012315<<<<<<<<<<<<<<<4
  if (line2.length >= 44) {
    result.passport_number = line2.substring(0, 9).replace(/</g, "");
    
    const nationality = line2.substring(10, 13).replace(/</g, "");
    if (nationality) result.nationality = nationality;
    
    const dob = line2.substring(13, 19);
    if (/^\d{6}$/.test(dob)) {
      const year = parseInt(dob.substring(0, 2));
      const fullYear = year > 50 ? 1900 + year : 2000 + year;
      result.date_of_birth = `${fullYear}-${dob.substring(2, 4)}-${dob.substring(4, 6)}`;
    }
    
    const sex = line2[20];
    if (sex === "M" || sex === "F") result.gender = sex;
    
    const expiry = line2.substring(21, 27);
    if (/^\d{6}$/.test(expiry)) {
      const year = parseInt(expiry.substring(0, 2));
      const fullYear = 2000 + year;
      result.expiry_date = `${fullYear}-${expiry.substring(2, 4)}-${expiry.substring(4, 6)}`;
    }
  }

  return result;
}

// === バリデーション ===
function validatePassport(parsed: ParsedPassport): string[] {
  const errors: string[] = [];
  if (parsed.passport_number && !/^[A-Z]{1,2}\d{7,8}$/.test(parsed.passport_number)) {
    errors.push("旅券番号の形式が不正です（例: AB1234567）");
  }
  if (parsed.expiry_date) {
    const expiry = new Date(parsed.expiry_date);
    if (isNaN(expiry.getTime())) {
      errors.push("有効期限の日付形式が不正です");
    } else if (expiry < new Date()) {
      errors.push("⚠️ パスポートの有効期限が切れています");
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
