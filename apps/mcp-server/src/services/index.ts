/**
 * SuguVisa Services — Re-export Hub
 * 
 * MCP ツールと REST API の両方から呼ばれる純粋なビジネスロジック関数を集約。
 * 各ツールファイルで定義された export 関数をここから re-export する。
 */

// === 判定・検証系 ===
export { determinePattern, buildLookupKey } from "../tools/determine-application.js";
export { getRequiredDocumentsData } from "../tools/required-documents.js";
export { calculateDeadlinesData } from "../tools/calculate-deadlines.js";

// validate-data: 個別バリデーション関数群
export {
  validateResidenceCardNumber,
  validateCorporateNumber,
  validateFurigana,
  validateDateFormat,
} from "../tools/validate-data.js";

// === 出力系 ===
export { generateAnnualReportCsvHandler } from "../tools/generate-annual-report-csv.js";
export { createOfflineExcel } from "../tools/generate-annual-report-offline.js";

// === 型定義 (REST API レスポンスで使用) ===
export interface ServiceResult {
  status: string;
  [key: string]: unknown;
}
