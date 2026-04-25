/**
 * MCP Prompts — よくあるワークフローのテンプレート
 * MCP Prompts — reusable workflow templates
 * MCP Prompts — template alur kerja yang dapat digunakan kembali
 *
 * 既存の register-tools.ts の registerPrompts() に加えて、
 * Phase 2 で増強した Resources / Golden Records を活かす新プロンプトを追加する。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  SUGUVISA_USER_ROLES,
  formatUserRoleGuidanceForAi,
  type SuguVisaUserRole,
} from "../lib/user-role-guidance.js";

function userText(lines: Array<string | false | null | undefined>): {
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
} {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: lines.filter((l): l is string => Boolean(l)).join("\n"),
        },
      },
    ],
  };
}

export function registerEnhancedPrompts(server: McpServer): void {
  server.prompt(
    "suguvisa_citation_answer_generate",
    "ユーザーからの質問に対して、Golden Records を検索し出典付きで回答するワークフロー",
    {
      question: z.string().describe("ユーザーの質問（自然言語）"),
      tenant_hint: z.string().optional().describe("テナント ID または組織名（あれば絞り込みに使う）"),
      user_role: z.enum(SUGUVISA_USER_ROLES).default("unknown").describe("ユーザーの立場。派遣元従業員は dispatching_organization_staff、派遣先担当者は dispatch_client_contact"),
    },
    async ({ question, tenant_hint, user_role }) =>
      userText([
        "あなたは特定技能ビザ申請の専門 AI です。以下の質問に回答してください。",
        formatUserRoleGuidanceForAi(user_role as SuguVisaUserRole),
        "",
        `質問: ${question}`,
        tenant_hint ? `テナントヒント: ${tenant_hint}` : "",
        "",
        "回答生成の手順:",
        "1. suguvisa://rules/version を読み、回答がどのバージョンのルールに基づくか確認する",
        "2. suguvisa_golden_records_search ツールを呼び出して、質問に関連する知識を 5 件まで取得する",
        "3. 取得した記録の citations を **必ず本文中に引用** する (形式: [ソース名](URL))",
        "4. ルールの有効期間 (validFrom / validUntil) を明示し、古い情報なら注意喚起を入れる",
        "5. 情報が不足している場合は推測せず、その旨を正直に述べる",
        "",
        "注意: 個人情報 (在留カード番号・氏名等) が質問文に含まれていたら、**回答本文ではマスク** すること。",
      ]),
  );

  server.prompt(
    "suguvisa_ssw2_field_eligibility_check",
    "特定技能2号の分野適合性を判定するワークフロー",
    {
      industry_field: z.string().describe("対象分野（例: '農業', '建設'）"),
      employment_type: z.string().optional().describe("雇用形態 (direct / dispatch)"),
      applicant_summary: z.string().optional().describe("申請人の経験・資格の要約"),
    },
    async ({ industry_field, employment_type, applicant_summary }) =>
      userText([
        `特定技能2号の ${industry_field} 分野への適合性を判定してください。`,
        employment_type ? `雇用形態: ${employment_type}` : "",
        applicant_summary ? `申請人情報: ${applicant_summary}` : "",
        "",
        "手順:",
        `1. suguvisa://industries/list を読み、${industry_field} の code を特定`,
        "2. その code で suguvisa://industries/{code} を読み、2号対応可否 / 監督経験要件を確認",
        "3. suguvisa_ssw2_checklist_get で必要書類を取得",
        "4. 監督経験が必要な分野で不足している場合は、2号への移行タイミングを提案",
        "5. 最終的に ✅適合 / ⚠️要追加要件 / ❌非対応 の3段階で判定",
        "",
        "判定結果は以下の Markdown で出力:",
        "| 観点 | 判定 | 根拠 | 次のアクション |",
        "| --- | --- | --- | --- |",
      ]),
  );

  server.prompt(
    "suguvisa_weekly_visa_status_review",
    "週次の在留状況レビューワークフロー (ダッシュボード生成)",
    {
      tenant_id: z.string().optional().describe("テナント ID (未指定ならリクエスト元)"),
    },
    async ({ tenant_id }) =>
      userText([
        "過去1週間のスタッフ在留状況をレビューし、行動が必要な案件をダッシュボード化してください。",
        tenant_id ? `対象テナント: ${tenant_id}` : "",
        "",
        "手順:",
        "1. suguvisa_staff_compliance_dashboard_get でスタッフ一覧と期限情報を取得",
        "2. suguvisa_deadlines_calculate で期限が近いスタッフ (🔴30日以内 / 🟡90日以内) を抽出",
        "3. suguvisa_periodic_notification_requirements_check で定期届出の提出状況を確認",
        "4. suguvisa://deadlines/rules を読んで、警告レベルの閾値を参照",
        "5. 以下のフォーマットでレビューを出力:",
        "",
        "# 週次在留状況レビュー",
        "## 🔴 緊急対応 (今週中)",
        "## 🟡 要注意 (今月中)",
        "## ✅ 順調",
        "## 📋 定期届出の進捗",
        "",
        "各セクションにはスタッフ名（マスク可）・期限・推奨アクションを含める。",
      ]),
  );

  server.prompt(
    "suguvisa_pre_submission_final_check",
    "提出直前の最終チェックワークフロー (紙 / オンライン両対応)",
    {
      pattern_id: z.string().describe("申請パターン ID (例: CHANGE_SSW1_C)"),
      industry_field: z.string().optional().describe("分野"),
      submission_mode: z.enum(["paper", "online"]).describe("提出方式"),
      user_role: z.enum(SUGUVISA_USER_ROLES).default("unknown").describe("ユーザーの立場。派遣元従業員は dispatching_organization_staff、派遣先担当者は dispatch_client_contact"),
    },
    async ({ pattern_id, industry_field, submission_mode, user_role }) =>
      userText([
        `${pattern_id} の申請を ${submission_mode === "paper" ? "紙" : "オンライン"} で提出する前の最終チェックを行ってください。`,
        formatUserRoleGuidanceForAi(user_role as SuguVisaUserRole),
        industry_field ? `分野: ${industry_field}` : "",
        "",
        "手順:",
        `1. suguvisa://patterns/${pattern_id} を読み、パターンの詳細と必要書類を確認`,
        industry_field ? "2. suguvisa://industries/list で分野コードを特定し、分野固有書類を確認" : "",
        "3. suguvisa_submission_checklist_verify で提出前チェックを実行",
        "4. 都道府県別最低賃金・管轄入管局の確認",
        "5. ふりがながカタカナになっていないか、法人番号が13桁か等の機械的検証を再実施",
        submission_mode === "paper"
          ? "6. suguvisa_paper_form_generate で最終 PDF を生成し、手書きエリアの指示を明示"
          : "6. suguvisa_bulk_xlsm_generate / suguvisa_online_csv_generate で最終データを出力。公式XLSMのマクロを壊さず、初心者には操作手順、経験者には差分確認を優先",
        "7. オンライン申請は在留期限日の前日まで。当日または期限切れなら専門家レビューへ回す",
        "8. 留学から特定技能への変更では出席率80%以上、卒業/中退証明、理由書、資格外活動状況を確認",
        "9. 外国人の理解言語に合わせ、雇用契約書・雇用条件書・支援計画書等の母国語併記を確認",
        "",
        "最後に、以下のチェックリストを Markdown で出力:",
        "- [ ] 必要書類がすべて揃っているか",
        "- [ ] ふりがなの形式 (ひらがな)",
        "- [ ] 法人番号・マイナンバーの桁数",
        "- [ ] 署名・押印欄",
        "- [ ] バイリンガル様式の言語版",
        "- [ ] 管轄入管局の住所",
        "- [ ] オンライン申請期限（在留期限日の前日まで）",
        "- [ ] 高リスクレビュー要否（不法就労示唆・業務不一致・根拠不足）",
      ]),
  );

  server.prompt(
    "suguvisa_incident_triage",
    "MCP / アプリケーションのインシデント一次対応ワークフロー",
    {
      symptom: z.string().describe("利用者が観測している症状"),
      tool_name: z.string().optional().describe("エラーが出たツール名 (あれば)"),
    },
    async ({ symptom, tool_name }) =>
      userText([
        "以下のインシデントを一次トリアージしてください。",
        `症状: ${symptom}`,
        tool_name ? `ツール: ${tool_name}` : "",
        "",
        "手順:",
        "1. suguvisa://server/info を読み、稼働中のバージョンと機能を確認",
        "2. suguvisa://server/changelog を読み、直近の変更を特定",
        "3. ユーザーへの 3 つの質問を提示 (再現手順 / エラー内容 / 発生時刻)",
        "4. 仮説を 3 つまで立て、それぞれの対処方法を提示",
        "5. 回避策と正式修正の両方を提案",
        "6. 必要があれば SLO (suguvisa://server/slo) を参照して対応SLAを明記",
      ]),
  );

  server.prompt(
    "suguvisa_tenant_onboarding",
    "新規テナント (行政書士事務所 / 受入れ機関) のオンボーディング",
    {
      organization_name: z.string().optional().describe("組織名"),
      plan: z.string().optional().describe("プラン (Free / Standard / Enterprise)"),
    },
    async ({ organization_name, plan }) =>
      userText([
        `${organization_name ?? "新規組織"} の SuguVisa オンボーディングを行ってください。`,
        plan ? `プラン: ${plan}` : "",
        "",
        "手順:",
        "1. suguvisa://server/info でサポートされるクライアント / 機能を説明",
        "2. suguvisa://server/slo でプラン別サポート SLA を案内",
        "3. suguvisa://compliance/pii を読み上げ、PII 取扱いについて合意を得る",
        "4. プランに応じた利用可能ツールを整理",
        "5. 初期セットアップチェックリストを提示 (OAuth / API キー / Claude.ai 連携)",
      ]),
  );
}
