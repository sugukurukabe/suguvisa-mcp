import { z } from "zod";
import * as codes from "./isa-codes.json";

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
  application_type: z.enum(["1", "2", "3"]).describe("申請種別 (1:認定, 2:更新, 3:変更)。エラー時：システムが自動判定できなかった可能性があります。「認定、更新、変更のどれですか？」とユーザーに確認してください。"),
  
  family_name_romaji: z.string().transform(sanitizeRomaji).refine(v => v.length > 0, "氏（ローマ字）は必須です").describe("氏（ローマ字）大文字"),
  given_name_romaji: z.string().transform(sanitizeRomaji).refine(v => v.length > 0, "名（ローマ字）は必須です").describe("名（ローマ字）大文字"),
  
  nationality_code: z.string().transform(toHankaku).transform(v => v.toUpperCase()).refine(v => /^[A-Z]{3}$/.test(v), "国籍コードは3桁のアルファベットである必要があります").describe("国籍コード (3桁アルファベット, 例: IDN)"),
  
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
  
  industry_field_code: z.string().transform(toHankaku).refine(v => /^\d{4}$/.test(v), "分野コードは4桁の半角数字です (例: 0100 for 農業)").describe("指定産業分野コード"),
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
