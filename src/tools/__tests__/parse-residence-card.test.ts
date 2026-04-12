import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerParseResidenceCard, parseResidenceCardHandler } from "../parse-residence-card.js";
import * as documentAI from "../../lib/document-ai.js";
import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../lib/document-ai.js");

const mockedProcessDocument = documentAI.processDocument as any;

describe("parse_residence_card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Document AIの結果マッピングが正しいか", async () => {
    const handler = parseResidenceCardHandler;
    
    // モックの設定
    mockedProcessDocument.mockResolvedValueOnce({
      fullText: "これはダミーテキストです。特定技能1号",
      entities: {
        family_name: "YOKOHAMA",
        given_name: "TARO",
        date_of_birth: "1990-01-01",
        gender: "Male",
        nationality: "Indonesia",
        document_type: "特定技能1号",
        expiry_date: "2028-04-01",
        document_id: "AB12345678CD",
        address: "東京都新宿区1-1-1",
      },
      confidence: 0.95,
      pageCount: 1,
    });

    const result = await handler({
      image_base64: "dummy_base64_data",
      image_mime_type: "image/jpeg",
    });

    const parsedResult = JSON.parse(result.content[0].text);
    
    expect(parsedResult.parsed).toMatchObject({
      name_romaji: "YOKOHAMA TARO",
      date_of_birth: "1990-01-01",
      gender: "Male",
      nationality: "Indonesia",
      visa_type: "特定技能1号",
      visa_expiry: "2028-04-01",
      residence_card_number: "AB12345678CD",
      address: "東京都新宿区1-1-1",
      _method: "document_ai",
      _confidence: 0.95,
    });
    
    expect(parsedResult.extraction_method).toBe("document_ai");
    expect(parsedResult.validation_errors).toHaveLength(0);
  });

  it("2. 正規表現フォールバックが動作するか", async () => {
    const handler = parseResidenceCardHandler;
    
    const ocrText = `
      氏名 NAME
      YAMADA JIRO
      生年月日 Date of Birth 1985年12月31日
      性別 Sex 男
      国籍・地域 Nationality/Region Vietnam
      在留資格 Status of Residence 技能実習1号
      就労制限 Permission to engage 就労不可
      在留期間（満了日） Period of Stay (Date of Expiration) 2025年10月01日
      AB87654321EF
    `;

    const result = await handler({
      ocr_text: ocrText,
    });

    const parsedResult = JSON.parse(result.content[0].text);
    
    expect(parsedResult.parsed).toMatchObject({
      name_romaji: "YAMADA JIRO",
      date_of_birth: "1985-12-31",
      gender: "男",
      nationality: "Vietnam",
      visa_type: "技能実習1号",
      visa_expiry: "2025-10-01",
      residence_card_number: "AB87654321EF",
      work_restriction: "就労不可",
      _method: "regex",
    });
    expect(parsedResult.validation_errors).toHaveLength(0);
  });

  it("3. 和暦（令和5年）→ 西暦（2023年）の変換", async () => {
    const handler = parseResidenceCardHandler;
    
    const ocrText = `
      在留期間（満了日） Period of Stay (Date of Expiration) 令和5年10月01日
      生年月日 Date of Birth 平成10年05月15日
    `;

    const result = await handler({
      ocr_text: ocrText,
    });

    const parsedResult = JSON.parse(result.content[0].text);
    
    expect(parsedResult.parsed.visa_expiry).toBe("2023-10-01");
    expect(parsedResult.parsed.date_of_birth).toBe("1998-05-15");
  });

  it("4. 在留カード番号のバリデーション", async () => {
    const handler = parseResidenceCardHandler;
    
    // Document AIで不正なカード番号が返されたケースをモック
    mockedProcessDocument.mockResolvedValueOnce({
      fullText: "A1234567B9",
      entities: {
        document_id: "A1234567B9", // 不正な形式（短すぎるなど）
      },
      confidence: 0.95,
      pageCount: 1,
    });

    const result = await handler({
      image_base64: "dummy",
      image_mime_type: "image/jpeg",
    });

    const parsedResult = JSON.parse(result.content[0].text);
    
    // validateParsedData によってエラーになっているか
    expect(parsedResult.validation_errors).toContain("在留カード番号の形式が不正です（正しい形式: AB12345678CD）");
  });

  it("5. Document AI失敗時のフォールバック動作", async () => {
    const handler = parseResidenceCardHandler;
    
    // Document AI がエラーを投げる
    mockedProcessDocument.mockRejectedValueOnce(new Error("API Error"));

    const ocrText = `
      YAMADA JIRO
      AB87654321EF
    `;

    const result = await handler({
      image_base64: "dummy_base64",
      image_mime_type: "image/jpeg",
      ocr_text: ocrText, // フォールバック用に ocr_text を提供
    });

    const parsedResult = JSON.parse(result.content[0].text);
    
    expect(parsedResult.parsed).toMatchObject({
      name_romaji: "YAMADA JIRO",
      residence_card_number: "AB87654321EF",
      _method: "regex_fallback", // エラーからフォールバックした記録
    });
  });

  it("6. 画像もOCRテキストもない場合のエラー", async () => {
    const handler = parseResidenceCardHandler;
    
    const result = await handler({});
    const parsedResult = JSON.parse(result.content[0].text);
    
    expect(parsedResult.error).toBe("image_base64 または ocr_text のどちらかを提供してください");
  });
});
