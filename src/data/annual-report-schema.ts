import { z } from "zod";
import { parseDateString, sanitizeRomaji, toHankaku } from "./csv-schema.js";

export const annualReportCsvSchema = z.object({
  // 必須: 名簿情報
  residence_card_number: z.string().transform(toHankaku).transform(v => v.toUpperCase()).refine((val) => /^[A-Z]{2}\d{8}[A-Z]{2}$/.test(val), {
    message: "在留カード番号は「英字2文字＋数字8桁＋英字2文字」である必要があります",
  }).describe("在留カード番号"),
  family_name_romaji: z.string().transform(sanitizeRomaji).refine(v => v.length > 0, "氏（ローマ字）は必須です").describe("氏（ローマ字）"),
  given_name_romaji: z.string().transform(sanitizeRomaji).refine(v => v.length > 0, "名（ローマ字）は必須です").describe("名（ローマ字）"),
  date_of_birth: z.string().transform(parseDateString).refine((val) => /^\d{8}$/.test(val), {
    message: "生年月日はYYYYMMDD形式である必要があります",
  }).describe("生年月日"),
  sex: z.enum(["1", "2"]).describe("性別 (1:男, 2:女)"),

  // 受入れ状況 (Accepting Conditions)
  working_days: z.union([z.number(), z.string()]).transform(v => toHankaku(String(v)).replace(/\D/g, "")).refine(v => v.length > 0, "出勤日数が不明です").describe("該当期間の出勤日数"),
  paid_leave_days: z.union([z.number(), z.string()]).transform(v => toHankaku(String(v)).replace(/\D/g, "")).describe("該当期間の有給休暇取得日数"),
  monthly_salary_average: z.union([z.number(), z.string()]).transform(v => toHankaku(String(v)).replace(/\D/g, "")).refine(v => v.length > 0, "月額報酬の平均額が不明です").describe("該当期間の平均月額報酬額"),
  
  // 活動状況 (Activity Conditions)
  resignation_date: z.string().optional().transform(parseDateString).refine((val) => !val || /^\d{8}$/.test(val), {
    message: "離職日はYYYYMMDD形式である必要があります",
  }).describe("離職年月日 (離職した場合のみ)"),
  resignation_reason: z.string().optional().describe("離職理由"),

  // 支援実施状況 (Support Implementation)
  support_interview_date: z.string().optional().transform(parseDateString).refine((val) => !val || /^\d{8}$/.test(val), {
    message: "面談実施日はYYYYMMDD形式である必要があります",
  }).describe("直近の定期面談実施日"),
  support_status_code: z.enum(["1", "2", "3"]).optional().describe("支援実施状況 (1:適切に実施, 2:全部委託, 3:一部未実施)"),
});

export type AnnualReportCsvData = z.infer<typeof annualReportCsvSchema>;
