import { z } from "zod";
import * as codes from "./isa-codes.json";

// ────────────────────────────────────────────────────────
// 自動変換ユーティリティ（ユーザビリティ改善 v0.4.0）
// ────────────────────────────────────────────────────────

/** 国名→国籍コード自動変換 (例: 'インドネシア' → 'IDN') */
const nationalityNameToCode: Record<string, string> = {};
for (const [code, name] of Object.entries((codes as any).nationality_codes || {})) {
  nationalityNameToCode[String(name)] = code;
  nationalityNameToCode[String(name).toLowerCase()] = code;
}
// 英語名も対応
const enNationalityMap: Record<string, string> = {
  indonesia: "IDN", vietnam: "VNM", philippines: "PHL", china: "CHN",
  korea: "KOR", myanmar: "MMR", nepal: "NPL", thailand: "THA",
  cambodia: "KHM", mongolia: "MNG", "sri lanka": "LKA", india: "IND",
  usa: "USA", "united states": "USA",
};
Object.assign(nationalityNameToCode, enNationalityMap);

export const resolveNationalityCode = (val: string): string => {
  const v = val.trim();
  // Already a 3-letter code
  if (/^[A-Z]{3}$/.test(v)) return v;
  // Lookup by name
  return nationalityNameToCode[v] || nationalityNameToCode[v.toLowerCase()] || v;
};

/** 分野名→分野コード自動変換 (例: '農業' → '0100') */
const fieldNameToCode: Record<string, string> = {};
for (const [code, name] of Object.entries((codes as any).industry_field_codes || {})) {
  fieldNameToCode[String(name)] = code;
}
const enFieldMap: Record<string, string> = {
  agriculture: "0100", fishing: "0200", construction: "0300",
  "food manufacturing": "0400", "food service": "0500",
  manufacturing: "0600", shipbuilding: "0700", "auto maintenance": "0800",
  aviation: "0900", accommodation: "1000", "nursing care": "1100",
  cleaning: "1200", "auto transport": "1300", railway: "1400",
};
Object.assign(fieldNameToCode, enFieldMap);

export const resolveIndustryFieldCode = (val: string): string => {
  const v = val.trim();
  if (/^\d{4}$/.test(v)) return v;
  return fieldNameToCode[v] || fieldNameToCode[v.toLowerCase()] || v;
};

/** パターンIDまたはコンテキストから申請種別を自動推定 */
export const resolveApplicationType = (val: string): string => {
  const v = val.trim();
  if (/^[123]$/.test(v)) return v;
  const lower = v.toLowerCase();
  if (lower.includes("認定") || lower.includes("coe") || lower.includes("grant")) return "1";
  if (lower.includes("更新") || lower.includes("renewal") || lower.includes("renew")) return "2";
  if (lower.includes("変更") || lower.includes("change")) return "3";
  return v;
};

/** 氏名自動分割 (例: 'GILANG PERMANA' → { family: 'PERMANA', given: 'GILANG' }) */
export const splitRomajiName = (fullName: string): { family: string; given: string } => {
  const parts = fullName.trim().toUpperCase().split(/\s+/);
  if (parts.length === 0) return { family: "", given: "" };
  if (parts.length === 1) return { family: parts[0], given: "" };
  // Convention: last part = family name, rest = given name(s)
  // (This matches Indonesian/SEA naming conventions)
  return {
    family: parts[parts.length - 1],
    given: parts.slice(0, -1).join(" "),
  };
};

// ユーティリティ: 全角英数字記号を半角に変換
export const toHankaku = (val?: string): string => {
  if (!val) return "";
  const hankaku = val.replace(/[Ａ-Ｚａ-ｚ０-９！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
  return hankaku.trim();
};

// ユーティリティ: ローマ字氏名用サニタイズ（全角を半角にし、大文字化、アルファベットと一部記号のみ許容）
export const sanitizeRomaji = (val?: string): string => {
  if (!val) return "";
  const h = toHankaku(val).toUpperCase();
  // 半角アルファベット、スペース、ハイフンのみ許可
  return h.replace(/[^A-Z \-]/g, "");
};

// ユーティリティ: 電話番号用サニタイズ
export const sanitizePhone = (val?: string): string => {
  if (!val) return "";
  // 長音符や全角ダッシュをハイフンに置き換え
  let h = val.replace(/[ー−—‐]/g, "-");
  h = toHankaku(h);
  // 数字とハイフン、プラス記号などに限定
  return h.replace(/[^0-9\-+()]/g, "");
};

// ユーティリティ: 日付文字列の正規化 (例: "2000年7月7日", "2000-07-07", "平成5年4月1日" -> "20000707")
export const parseDateString = (val?: string): string => {
  if (!val) return "";
  let h = toHankaku(val);

  // 和暦対応（令和、平成、昭和）
  const eraMatch = h.match(/(令和|平成|昭和)(\d+|元)年(\d{1,2})月(\d{1,2})日/);
  if (eraMatch) {
    const eraOffsets: Record<string, number> = { "令和": 2018, "平成": 1988, "昭和": 1925 };
    let eraYear = eraMatch[2] === "元" ? 1 : parseInt(eraMatch[2], 10);
    const year = eraOffsets[eraMatch[1]] + eraYear;
    const m = eraMatch[3].padStart(2, "0");
    const d = eraMatch[4].padStart(2, "0");
    return `${year}${m}${d}`;
  }

  const digitsOnly = h.replace(/\D/g, "");
  if (digitsOnly.length === 8) {
    return digitsOnly;
  }

  // YYYY年MM月DD日 または YYYY-MM-DD 等から抽出してゼロ埋め
  const match = h.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, "0");
    const d = match[3].padStart(2, "0");
    return `${y}${m}${d}`;
  }

  // フォーマットできない場合は半角化した元の文字列を返す
  return h;
};

export const officialCsvSchema = z.object({
  application_type: z.string().transform(resolveApplicationType).refine(v => /^[123]$/.test(v), "申請種別は 1(認定), 2(更新), 3(変更) のいずれかです。'認定','更新','変更','change','renewal','coe' でも自動判定します。").describe("申請種別 (1:認定, 2:更新, 3:変更)。'認定', '変更', 'change' などの文字列でも自動変換されます。"),
  
  family_name_romaji: z.string().transform(sanitizeRomaji).refine(v => v.length > 0, "氏（ローマ字）は必須です").describe("氏（ローマ字）大文字"),
  given_name_romaji: z.string().transform(sanitizeRomaji).refine(v => v.length > 0, "名（ローマ字）は必須です").describe("名（ローマ字）大文字"),
  
  nationality_code: z.string().transform(toHankaku).transform(resolveNationalityCode).transform(v => v.toUpperCase()).refine(v => /^[A-Z]{3}$/.test(v), "国籍コードは3桁のアルファベットである必要があります。'インドネシア', 'Indonesia' 等の国名でも自動変換されます。").describe("国籍コードまたは国名（例: 'IDN', 'インドネシア', 'Indonesia'）。自動変換されます。"),
  
  date_of_birth: z.string().transform(parseDateString).refine((val) => /^\d{8}$/.test(val), {
    message: "生年月日はYYYYMMDD形式である必要があります",
  }).describe("生年月日。エラー時：「生年月日の形式が認識できませんでした。西暦YYYY年MM月DD日の形式で教えていただけますか？」とユーザーに確認してください。"),
  
  sex: z.enum(["1", "2"]).describe("性別 (1:男, 2:女)"),
  
  passport_number: z.string().transform(toHankaku).transform(v => v.toUpperCase()).refine(v => /^[A-Z0-9]+$/.test(v) || v === "申請中" || v === "無", "旅券番号は半角英数字、または「申請中」「無」である必要があります").describe("旅券番号。エラー時：「パスポート番号は半角英数字で入力されていますか？もしパスポートがない場合は『申請中』や『無』とお伝えください」と案内してください。"),
  
  residence_card_number: z.string().optional().transform(toHankaku).transform(v => v.toUpperCase()).refine((val) => !val || /^[A-Z]{2}\d{8}[A-Z]{2}$/.test(val), {
    message: "在留カード番号は「英字2文字＋数字8桁＋英字2文字」である必要があります",
  }).describe("在留カード番号 (認定の場合は不要)。エラー時：「在留カード番号は『英字2文字＋数字8桁＋英字2文字』です。入力をご確認いただけますか？」と案内してください。"),
  
  current_visa_type: z.string().optional().describe("現在の在留資格"),
  
  visa_expiry_date: z.string().optional().transform(parseDateString).refine((val) => !val || /^\d{8}$/.test(val), {
    message: "在留期限はYYYYMMDD形式である必要があります",
  }).describe("在留期限"),
  
  desired_visa_type: z.string().describe("希望する在留資格"),
  desired_period: z.string().describe("希望する在留期間"),
  
  company_name: z.string().min(1).describe("所属機関名称"),
  
  corporate_number: z.string().optional().transform(toHankaku).refine(v => !v || /^\d{13}$/.test(v), "法人番号は13桁の半角数字である必要があります").describe("法人番号 (個人事業主の場合は不要またはダミー)。エラー時：「法人番号は13桁の数字です。入力内容をご確認ください。」と案内してください。"),
  
  company_address: z.string().min(1).describe("所属機関所在地"),
  company_phone: z.string().transform(sanitizePhone).refine(v => v.length > 0, "電話番号は必須です").describe("所属機関電話番号"),
  representative: z.string().min(1).describe("代表者氏名"),
  
  industry_field_code: z.string().transform(toHankaku).transform(resolveIndustryFieldCode).refine(v => /^\d{4}$/.test(v), "分野コードは4桁の半角数字です (例: 0100 for 農業)。'農業', 'agriculture' 等の分野名でも自動変換されます。").describe("産業分野コードまたは分野名（例: '0100', '農業', 'agriculture'）。自動変換されます。"),
  work_description: z.string().min(1).describe("業務区分"),
  
  monthly_salary: z.union([z.number(), z.string()]).transform(v => toHankaku(String(v)).replace(/\D/g, "")).refine(v => v.length > 0, "報酬月額が空または不正です").describe("報酬月額（数字のみ）"),
  
  contract_start_date: z.string().transform(parseDateString).refine((val) => /^\d{8}$/.test(val), {
    message: "契約開始日はYYYYMMDD形式である必要があります",
  }).describe("契約開始日"),
  contract_end_date: z.string().optional().transform(parseDateString).refine((val) => !val || /^\d{8}$/.test(val), {
    message: "契約終了日はYYYYMMDD形式である必要があります",
  }).describe("契約終了日"),
  
  support_type: z.enum(["1", "2", "3"]).optional().describe("支援形態 (1:全部自社支援, 2:全部委託, 3:一部委託)"),
  support_org_number: z.string().optional().describe("登録支援機関番号 (委託の場合のみ)"),
});

export type OfficialCsvData = z.infer<typeof officialCsvSchema>;
