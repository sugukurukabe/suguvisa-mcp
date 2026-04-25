export const SUGUVISA_USER_ROLES = [
  "support_organization_staff",
  "foreign_worker",
  "accepting_organization",
  "dispatching_organization_staff",
  "dispatch_client_contact",
  "immigration_lawyer",
  "lawyer",
  "admin_staff",
  "unknown",
] as const;

export type SuguVisaUserRole = (typeof SUGUVISA_USER_ROLES)[number];

export interface UserRoleGuidance {
  role: SuguVisaUserRole;
  labelJa: string;
  labelEn: string;
  primaryConcerns: string[];
  suguVisaContribution: string;
  answerPolicy: string;
  responsibilityBoundary: string;
  requiredFocus: string[];
  recommendedTools: string[];
}

const ROLE_GUIDANCE: Record<SuguVisaUserRole, UserRoleGuidance> = {
  support_organization_staff: {
    role: "support_organization_staff",
    labelJa: "登録支援機関の職員",
    labelEn: "Registered support organization staff",
    primaryConcerns: ["支援計画", "義務的支援10項目", "定期面談", "随時届出", "年次・定期届出"],
    suguVisaContribution:
      "支援実施・記録・届出の漏れを防ぎ、支援責任者と支援担当者が確認すべき期限と証跡を整理します。",
    answerPolicy:
      "支援機関として何をいつまでに実施・記録・提出するかを先に示し、所属機関・本人・専門家の担当を分けて説明します。",
    responsibilityBoundary:
      "雇用契約判断や個別法律相談を断定せず、最終判断が必要な箇所は行政書士・弁護士確認へ回します。",
    requiredFocus: ["14日届出", "年次届出", "面談記録", "支援実施状況", "委託・自社支援の区別"],
    recommendedTools: [
      "suguvisa_periodic_notification_requirements_check",
      "suguvisa_periodic_notification_generate",
      "suguvisa_deadlines_calculate",
      "suguvisa_audit_action_log",
    ],
  },
  foreign_worker: {
    role: "foreign_worker",
    labelJa: "外国人本人",
    labelEn: "Foreign worker / applicant",
    primaryConcerns: ["自分が働けるか", "更新・変更に必要なもの", "期限", "試験免除", "転職時の注意", "申請費用と郵送物"],
    suguVisaContribution:
      "本人が次に集める書類、会社に確認すること、働いてよい範囲、費用・収入印紙・郵送物をやさしい日本語・英語・インドネシア語で整理します。",
    answerPolicy:
      "法律用語を減らし、「あなたが今すること」「会社に頼むこと」「専門家に確認すること」に分けて説明します。",
    responsibilityBoundary:
      "就労可否や在留資格の最終判断は入管・専門家の判断であることを明示し、退職後すぐ別会社で働ける等の誤解を訂正し、根拠がない場合は断定しません。",
    requiredFocus: ["本人準備書類", "在留期限", "現在働ける範囲", "退職後の就労不可リスク", "会社への確認事項", "試験免除"],
    recommendedTools: [
      "suguvisa_visa_guide_get",
      "suguvisa_required_documents_list",
      "suguvisa_deadlines_calculate",
      "suguvisa_residence_card_parse",
    ],
  },
  accepting_organization: {
    role: "accepting_organization",
    labelJa: "通常の所属機関・受入れ企業",
    labelEn: "Accepting organization / direct employer",
    primaryConcerns: ["雇用契約", "報酬", "労働条件", "協議会加入", "社保・税", "監査対応"],
    suguVisaContribution:
      "会社側が用意すべき書類、契約条件、法人番号、参考様式、届出義務を本人・支援機関の担当と分けて整理します。",
    answerPolicy:
      "会社が用意するもの、本人が用意するもの、支援機関・行政書士に依頼するものを明確に分離します。",
    responsibilityBoundary:
      "労務・入管法の境界で高リスクな場合は、下書き・確認用として出し、専門家レビューを促します。",
    requiredFocus: ["所属機関概要書", "雇用契約書", "報酬説明", "協議会加入", "社保・税証明"],
    recommendedTools: [
      "suguvisa_required_documents_list",
      "suguvisa_reference_form_generate",
      "suguvisa_submission_checklist_verify",
      "suguvisa_corporate_number_lookup",
    ],
  },
  dispatching_organization_staff: {
    role: "dispatching_organization_staff",
    labelJa: "派遣元会社の従業員・関係者",
    labelEn: "Dispatching organization staff",
    primaryConcerns: ["派遣元としての所属機関責任", "派遣個別契約", "派遣計画書", "就業条件明示書", "派遣先変更届", "契約満了日", "勤怠・請求"],
    suguVisaContribution:
      "通常の受入れ企業向け書類に加え、派遣固有の書類セット、派遣元・派遣先・本人の分担、14日届出、契約満了、勤怠・請求リスクを明確にします。",
    answerPolicy:
      "派遣元が作るもの、派遣先から回収するもの、本人から回収するもの、専門家確認が必要なものに分けます。",
    responsibilityBoundary:
      "派遣が認められる分野・派遣形態の要件を確認せずに、通常雇用と同じ案内をしません。",
    requiredFocus: [
      "派遣計画書（参考様式第1-12号）",
      "就業条件明示書（参考様式第1-13号）",
      "派遣先概要書（参考様式第1-14号）",
      "派遣先事業者誓約書",
      "派遣先変更時の14日届出",
      "派遣先の押印書類",
      "契約満了日",
    ],
    recommendedTools: [
      "suguvisa_required_documents_list",
      "suguvisa_reference_form_generate",
      "suguvisa_periodic_notification_requirements_check",
      "suguvisa_deadlines_calculate",
    ],
  },
  dispatch_client_contact: {
    role: "dispatch_client_contact",
    labelJa: "派遣先担当者・派遣先関係者",
    labelEn: "Dispatch client contact",
    primaryConcerns: ["就業場所", "指揮命令者", "派遣先責任者", "安全衛生", "派遣先概要書", "社保遵守資料", "押印書類"],
    suguVisaContribution:
      "派遣先が直接作る・署名する・派遣元へ渡す資料だけを抽出し、所属機関本体の申請書類と混同しないようにします。",
    answerPolicy:
      "派遣先に必要な情報だけを簡潔に出し、派遣元が処理すべき申請本体・雇用契約とは分離します。",
    responsibilityBoundary:
      "派遣先を特定技能所属機関そのものとして扱わず、派遣先としての確認・資料提供の範囲に限定します。",
    requiredFocus: ["派遣先概要書", "派遣先責任者", "指揮命令者", "就業場所", "安全衛生", "苦情処理", "押印書類"],
    recommendedTools: [
      "suguvisa_intake_sheet_generate",
      "suguvisa_reference_form_generate",
      "suguvisa_submission_checklist_verify",
    ],
  },
  immigration_lawyer: {
    role: "immigration_lawyer",
    labelJa: "行政書士",
    labelEn: "Immigration scrivener",
    primaryConcerns: ["申請種別", "根拠資料", "必要書類", "省略条件", "理由書", "補正リスク", "高リスクレビュー"],
    suguVisaContribution:
      "専門家レビューに使えるよう、根拠URI、出典日、信頼度、未確認点、補正リスク、提出前チェックを構造化します。",
    answerPolicy:
      "確認済み・要確認・推定を分け、一般説明より根拠と差分を優先します。",
    responsibilityBoundary:
      "専門家の職責を代替する表現を避け、最終提出前レビューの材料として出します。",
    requiredFocus: ["根拠URI", "出典日", "様式番号", "省略条件", "補正リスク", "当日オンライン申請不可", "監査ログ"],
    recommendedTools: [
      "suguvisa_legal_docs_search",
      "suguvisa_required_documents_list",
      "suguvisa_reason_letter_generate",
      "suguvisa_submission_checklist_verify",
    ],
  },
  lawyer: {
    role: "lawyer",
    labelJa: "弁護士",
    labelEn: "Lawyer",
    primaryConcerns: ["法的リスク", "不許可・補正対応", "紛争予防", "代理範囲", "証拠資料"],
    suguVisaContribution:
      "法的争点、行政手続上のリスク、証拠関係、専門家レビューに必要な未確認点を整理します。",
    answerPolicy:
      "断定を避け、根拠・リスク・追加確認事項を優先して出します。",
    responsibilityBoundary:
      "法的助言の代替ではなく、弁護士レビューの下準備として構造化します。",
    requiredFocus: ["法的リスク", "証拠資料", "期限徒過", "不許可対応", "専門家レビュー"],
    recommendedTools: [
      "suguvisa_legal_docs_search",
      "suguvisa_submission_outcome_track",
      "suguvisa_audit_logs_list",
    ],
  },
  admin_staff: {
    role: "admin_staff",
    labelJa: "事務担当者",
    labelEn: "Administrative staff",
    primaryConcerns: ["不足情報", "入力シート", "書類回収", "期限管理", "提出前チェック", "一括申請Excel"],
    suguVisaContribution:
      "担当者が迷わず回収・入力・確認できるよう、作業順と不足情報をチェックリスト化します。",
    answerPolicy:
      "専門用語を必要最低限にし、作業単位のチェックリストを優先します。",
    responsibilityBoundary:
      "判断が必要な論点は社内責任者・専門家にエスカレーションします。",
    requiredFocus: ["不足情報", "入力シート", "回収先", "期限", "チェックリスト", "マクロ破壊防止", "母国語併記"],
    recommendedTools: [
      "suguvisa_intake_sheet_generate",
      "suguvisa_submission_checklist_verify",
      "suguvisa_deadlines_calculate",
    ],
  },
  unknown: {
    role: "unknown",
    labelJa: "立場未確認",
    labelEn: "Unknown role",
    primaryConcerns: ["立場確認", "一般説明", "高リスク回答の保留"],
    suguVisaContribution:
      "高リスクな案内の前に、本人・所属機関・派遣元/派遣先・支援機関・専門家のどの立場かを確認します。",
    answerPolicy:
      "まず立場を確認し、確認できるまでは一般論として回答します。",
    responsibilityBoundary:
      "立場が不明なまま、就労可否・提出書類・責任範囲を断定しません。",
    requiredFocus: ["立場確認", "申請段階", "雇用形態", "支援体制", "専門家確認"],
    recommendedTools: ["suguvisa_visa_guide_get", "suguvisa_required_documents_list"],
  },
};

export function getUserRoleGuidance(role: SuguVisaUserRole = "unknown"): UserRoleGuidance {
  return ROLE_GUIDANCE[role] ?? ROLE_GUIDANCE.unknown;
}

export function formatUserRoleGuidanceForAi(role: SuguVisaUserRole = "unknown"): string {
  const guidance = getUserRoleGuidance(role);
  return [
    `## ユーザー立場: ${guidance.labelJa} / ${guidance.labelEn}`,
    `貢献: ${guidance.suguVisaContribution}`,
    `回答方針: ${guidance.answerPolicy}`,
    `責任境界: ${guidance.responsibilityBoundary}`,
    `重点確認: ${guidance.requiredFocus.join("、")}`,
  ].join("\n");
}
