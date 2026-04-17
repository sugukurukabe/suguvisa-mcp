import { parseWithRegex, validateParsedData, normalizeDate } from "./src/tools/parse-residence-card.js";

// テスト用データ: わざと必要な項目（在留資格、カード番号など）を抜いています
const incompleteOcrText = `
氏名：GIANCARLO
国籍：イタリア
在留期間満了日：2027年4月
生年月日：1994年5月10日
`;

const parsed = parseWithRegex(incompleteOcrText);
parsed._method = "regex";

const missingFields = Object.keys(parsed).filter((k) => !k.startsWith("_") && !(parsed as any)[k]);
const filledFields = Object.entries(parsed)
  .filter(([k, v]) => !k.startsWith("_") && v !== null && v !== "")
  .length;
const totalFields = Object.keys(parsed)
  .filter((k) => !k.startsWith("_"))
  .length;

const validationErrors = validateParsedData(parsed);

const response = {
  content: [{
    type: "text" as const,
    text: JSON.stringify({
      parsed,
      extraction_method: parsed._method,
      confidence: parsed._confidence || null,
      fields_extracted: `${filledFields}/${totalFields}`,
      missing_fields: missingFields.length > 0 ? missingFields : "None",
      validation_errors: validationErrors,
      needs_confirmation: true,
      system_instruction: "【重要】missing_fieldsがある場合は、ユーザーに「XXが読み取れませんでした、入力してください」と必ず質問してください。推測（幻覚）による値の補完は絶対に禁止です。全ての情報が揃っている場合は、この内容で正しいか一言確認してください。",
      message_en: "IMPORTANT: If there are missing_fields, explicitly ask the user to provide them. DO NOT hallucinate values. Ask user to confirm if all data is correct.",
      message_id: "PENTING: Jika ada missing_fields, minta pengguna untuk melengkapinya. JANGAN asal menebak. Minta konfirmasi jika semua data sudah benar.",
      warning: "画像は即座に破棄されました / Image discarded / Gambar dibuang",
    }, null, 2),
  }],
};

console.log("=== 異常系（欠損フィールドあり）のテスト結果 ===\n");
console.log(response.content[0].text);
