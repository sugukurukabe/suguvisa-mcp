/**
 * SuguVisa スコープ定義
 * SuguVisa scope definitions
 * Definisi scope SuguVisa
 */

export const SUGUVISA_SCOPES = {
  'read:visa_case': '案件情報の参照',
  'read:golden_records': 'ゴールデンレコードの参照',
  'read:law_updates': '法改正情報の参照',

  'generate:reason_letter': '申請理由書の生成',
  'generate:paper_form': '紙申請書の自動マッピング',
  'generate:bulk_xlsm': '一括申請Excelの生成',
  'generate:annual_report': '定期届出CSVの生成',

  'validate:application_data': '申請データ検証',
  'review:document': 'AI書類レビュー',

  'write:submission_outcome': '申請結果の記録',
  'write:audit_log': '監査ログの記録',

  'admin:tenant': 'テナント設定の変更',
  'admin:golden_records': 'ゴールデンレコードの更新',
} as const;

export type Scope = keyof typeof SUGUVISA_SCOPES;

export const ALL_SCOPES = Object.keys(SUGUVISA_SCOPES) as Scope[];
