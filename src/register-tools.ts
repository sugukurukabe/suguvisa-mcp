import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllResources } from "./register-resources.js";
import { z } from "zod";
import { registerDetermineApplication } from "./tools/determine-application.js";
import { registerRequiredDocuments } from "./tools/required-documents.js";
import { registerValidateData } from "./tools/validate-data.js";
import { registerGenerateIntakeSheet } from "./tools/generate-intake-sheet.js";
import { registerParseResidenceCard } from "./tools/parse-residence-card.js";
import { registerCalculateDeadlines } from "./tools/calculate-deadlines.js";
import { registerGenerateBulkXlsm } from "./tools/generate-bulk-xlsm.js";
import { registerGeneratePaperForm } from "./tools/generate-paper-form.js";
import { registerLawUpdates } from "./tools/law-updates.js";
import { registerSearchLegalDocs } from "./tools/search-legal-docs.js";
import { registerAutonomousVisaWorkflow } from "./tools/autonomous-visa-workflow.js";
import { registerTrackSubmissionOutcome } from "./tools/track-submission-outcome.js";
import { registerGenerateAnnualReportCsv } from "./tools/generate-annual-report-csv.js";
import { registerGenerateAnnualReportOffline } from "./tools/generate-annual-report-offline.js";
import { registerLogVisaAction } from "./tools/log-visa-action.js";
import { registerGetVisaAuditLogs } from "./tools/get-visa-audit-logs.js";
import { registerCompleteVisaGuide } from "./tools/complete-visa-guide.js";
import { registerGenerateReferenceForm } from "./tools/generate-reference-form.js";
import { registerLookupCorporateNumber } from "./tools/lookup-corporate-number.js";
import { registerSSW2DocumentChecklist } from "./tools/ssw2-document-checklist.js";
import { registerGenerateReasonLetter } from "./tools/generate-reason-letter.js";
import { registerPreSubmissionChecklist } from "./tools/pre-submission-checklist.js";

/**
 * 全24ツール + 8プロンプト + 6リソースを McpServer に登録する共通関数。
 * stdio (index.ts) と HTTP (server.ts) の両方から呼ばれる。
 */
export function registerAllTools(server: McpServer): void {
  // === 判定・検証系 ===
  registerDetermineApplication(server);   // 申請種別の自動判定
  registerRequiredDocuments(server);       // 必要書類リスト
  registerValidateData(server);            // 入力データの検証
  registerCalculateDeadlines(server);      // 期限計算

  // === 入力支援系 ===
  registerGenerateIntakeSheet(server);     // クライアント向け入力シート生成
  registerParseResidenceCard(server);      // 在留カードOCR結果の構造化
  registerLookupCorporateNumber(server);   // 法人番号API検索

  // === 出力系 ===
  registerGenerateBulkXlsm(server);        // オンライン一括申請用XLSM生成
  registerGeneratePaperForm(server);       // 紙申請用PDFフォーム入力
  registerGenerateAnnualReportCsv(server); // 定期報告データ（オンラインCSV / 紙面データ両対応）
  registerGenerateAnnualReportOffline(server); // 定期報告（オフラインExcel版生成）
  registerGenerateReferenceForm(server);   // 参考様式テンプレート生成
  registerGenerateReasonLetter(server);    // 申請理由書テンプレート生成

  // === ワークフロー系 ===
  registerAutonomousVisaWorkflow(server);  // LangGraph 自律型ワークフロー

  // === フィードバック系（HITL/監査） ===
  registerTrackSubmissionOutcome(server);   // 申請結果フィードバック
  registerLogVisaAction(server);            // ビジネスアクション監査ログ登録
  registerGetVisaAuditLogs(server);         // 監査ログ取得

  // === 情報系 ===
  registerLawUpdates(server);              // 法改正情報
  registerSearchLegalDocs(server);         // 法務ドキュメントRAG検索

  // === インテントベース統合ツール ===
  registerCompleteVisaGuide(server);        // ワンショット完全ガイド（判定+書類+期限の統合）
  registerSSW2DocumentChecklist(server);    // 特定技能2号 分野別書類チェックリスト
  registerPreSubmissionChecklist(server);   // 提出前最終チェックリスト

  // === MCP Prompts（定型シナリオ） ===
  registerPrompts(server);

  // === MCP Resources（知識データの公開） ===
  registerAllResources(server);
}

/**
 * よく使う業務シナリオをMCP Promptsとして登録。
 * Claude等のAIクライアントがプロンプト一覧として表示できる。
 */
function registerPrompts(server: McpServer): void {
  // 1. 技能実習→特定技能の移行手続き一式
  server.prompt(
    "titp_to_ssw1_workflow",
    "技能実習から特定技能1号への移行手続きを一通り案内するワークフロー",
    {
      from_visa: z.string().describe("現在の在留資格（例: '技能実習2号'）"),
      industry_field: z.string().optional().describe("分野（例: '農業'）"),
      applicant_name: z.string().optional().describe("申請人氏名"),
    },
    async ({ from_visa, industry_field, applicant_name }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `${applicant_name ? applicant_name + "さんの" : ""}${from_visa}から特定技能1号への移行手続きを案内してください。`,
            industry_field ? `分野: ${industry_field}` : "",
            "",
            "以下のステップで進めてください:",
            "1. determine_application_type で申請パターンを判定",
            "2. get_required_documents で必要書類リストを取得",
            "3. generate_intake_sheet で入力シートを生成",
            "4. calculate_deadlines で期限を確認",
            "",
            "各ステップの結果をわかりやすくまとめてください。試験免除の条件も確認してください。",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  // 2. 転職時の手続きガイド
  server.prompt(
    "job_change_checklist",
    "特定技能1号スタッフの転職（雇用先変更）時に必要な手続き一式",
    {
      applicant_name: z.string().optional().describe("申請人氏名"),
      resignation_date: z.string().optional().describe("退職日（YYYY-MM-DD）"),
    },
    async ({ applicant_name, resignation_date }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `${applicant_name ? applicant_name + "さんが" : "スタッフが"}転職します。必要な手続きを案内してください。`,
            resignation_date ? `退職日: ${resignation_date}` : "",
            "",
            "以下を確認してください:",
            "1. determine_application_type で CHANGE_SSW1_D（転職パターン）を確認",
            resignation_date ? `2. calculate_deadlines で随時届出の期限を計算（event_date: ${resignation_date}）` : "2. calculate_deadlines で随時届出の期限を計算",
            "3. get_required_documents で必要書類を取得",
            "4. 申請中の就労ルールを説明（前の雇用主のもとでは就労可能、新しい雇用主のもとでは不可）",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  // 3. 更新申請の準備リスト
  server.prompt(
    "renewal_preparation",
    "特定技能1号の在留期間更新申請の準備ガイド",
    {
      expiry_date: z.string().optional().describe("在留期限（YYYY-MM-DD）"),
      ssw1_start_date: z.string().optional().describe("特定技能1号の通算開始日（YYYY-MM-DD）"),
    },
    async ({ expiry_date, ssw1_start_date }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "特定技能1号の在留期間更新申請の準備を案内してください。",
            expiry_date ? `在留期限: ${expiry_date}` : "",
            ssw1_start_date ? `通算開始日: ${ssw1_start_date}` : "",
            "",
            "以下のステップで進めてください:",
            expiry_date ? `1. calculate_deadlines で更新申請可能開始日と期限を計算（expiry_date: ${expiry_date}${ssw1_start_date ? `, ssw1_start_date: ${ssw1_start_date}` : ""})` : "1. calculate_deadlines で期限を計算",
            "2. determine_application_type で RENEWAL_01 を確認",
            "3. get_required_documents で必要書類を取得（更新時の省略条件に注意）",
            "4. generate_intake_sheet で入力シートを生成",
            ssw1_start_date ? "5. 通算在留期間の残りも確認し、2号移行の検討を促す" : "",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  // 4. 在留カード情報の確認 & 検証
  server.prompt(
    "verify_residence_card",
    "在留カードOCR結果の検証と申請データへの反映",
    {
      ocr_text: z.string().describe("在留カードのOCR読み取り結果テキスト"),
    },
    async ({ ocr_text }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "以下の在留カードOCR結果を処理してください。",
            "",
            "```",
            ocr_text,
            "```",
            "",
            "1. parse_residence_card でOCRテキストを構造化データに変換",
            "2. validate_application_data で各フィールドを検証（在留カード番号、在留期限等）",
            "3. 結果をまとめて、不足情報や要確認事項を報告",
          ].join("\n"),
        },
      }],
    })
  );
  // 5. ビジュアル期限チェッカー
  server.prompt(
    "visual_deadline_calculator",
    "Mermaidを活用した視覚的な期限タイムラインと手続き提案",
    {
      expiry_date: z.string().optional().describe("在留期限（YYYY-MM-DD）"),
      event_date: z.string().optional().describe("届出事由の発生日（YYYY-MM-DD）"),
    },
    async ({ expiry_date, event_date }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "各種スケジュールと期限を計算し、タイムライン図として出力してください。",
            expiry_date ? `在留期限: ${expiry_date}` : "",
            event_date ? `届出発生日: ${event_date}` : "",
            "",
            "以下の手順で回答を出力してください:",
            "1. calculate_deadlines を使用して期限データを取得",
            "2. 取得したデータを元に、Mermaid記法によるガントチャートまたはタイムライン（`mermaid` コードブロック）を描画する",
            "3. ツールから返却された _ai_summary_guidelines の指示に従い、警告や注意喚起を Markdown アラートで提示する",
            "4. 最後に、次のアクション（書類の準備など）をガイドする",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  // 6. 自律型ビザ申請ウィザード (LangGraph 連動)
  server.prompt(
    "autonomous_visa_wizard",
    "ユーザーと対話しながら不足データを集め、書類を一括生成するウィザード",
    {
      applicant_name: z.string().optional().describe("申請人氏名"),
    },
    async ({ applicant_name }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "自律型ビザ申請ワークフローを開始し、対話をリードしてください。",
            applicant_name ? `対象者: ${applicant_name}` : "",
            "",
            "以下の手順で進めてください:",
            "1. start_autonomous_visa_workflow を呼び出す（持っている情報があれば applicant_data に含める）",
            "2. もし status が 'waiting_for_human' で返ってきたら:",
            "   - _ai_instructions の指示に従い、不足フィールドの一覧を美しいMarkdownのチェックリストとして提示する",
            "   - ユーザーに「これらの情報を教えてください」と優しく尋ねる",
            "3. ユーザーが回答したら、 resume_autonomous_visa_workflow を呼び出して再開する",
            "4. 書類生成が完了するまで2〜3を繰り返す",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  // 7. 申請結果フィードバック（HITL自己改善ループ）
  server.prompt(
    "submission_feedback",
    "入管から申請結果が返ってきた際に、track_submission_outcome で記録するフィードバックワークフロー",
    {
      pattern_id: z.string().optional().describe("申請パターンID（例: 'CHANGE_SSW1_C'）"),
      applicant_name: z.string().optional().describe("申請人氏名"),
    },
    async ({ pattern_id, applicant_name }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `${applicant_name ? applicant_name + "さんの" : ""}申請結果を記録します。`,
            pattern_id ? `パターンID: ${pattern_id}` : "",
            "",
            "以下の手順で進めてください:",
            pattern_id ? "" : "1. まず申請パターンを確認します — determine_application_type で from_visa と to_visa を特定",
            "2. ユーザーに入管からの結果を聞いてください:",
            "   - 許可（ACCEPTED）",
            "   - 補正指示（REVISION_REQUIRED）→ 補正内容の詳細も聞く",
            "   - 不許可（REJECTED）",
            "3. track_submission_outcome で結果を記録",
            "4. 統計情報（同一パターンの補正率・通過率）が返ってくるので、分かりやすく提示",
            "5. 補正の場合は、次回申請への改善提案をまとめる",
            "6. 許可の場合は、次のステップ（在留カード受取・届出）を案内",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  // 8. 特定技能2号 申請準備ワークフロー
  server.prompt(
    "ssw2_application_preparation",
    "特定技能2号の申請準備を分野選択から書類チェックリストまで一通り案内するワークフロー",
    {
      industry_field: z.string().optional().describe("分野（例: '農業', '建設'）"),
      employment_type: z.string().optional().describe("雇用形態（例: 'direct', 'dispatch_corporate'）"),
      applicant_name: z.string().optional().describe("申請人氏名"),
    },
    async ({ industry_field, employment_type, applicant_name }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `${applicant_name ? applicant_name + "さんの" : ""}特定技能2号の申請準備を案内してください。`,
            industry_field ? `分野: ${industry_field}` : "",
            employment_type ? `雇用形態: ${employment_type}` : "",
            "",
            "以下のステップで進めてください:",
            "1. 分野が未指定の場合は、11分野から選択してもらう",
            "2. get_ssw2_document_checklist で分野・雇用形態別の必要書類チェックリストを取得",
            "3. 🟢自動生成可能な書類と🔴ユーザーが用意する書類を分けて提示",
            "4. 🔴ユーザー用意の書類については取得先と目安期間をアドバイス",
            "5. 🟢自動生成の書類については generate_reference_form での一括生成を提案",
            "6. チェックリストUIのリンクも案内",
            "",
            "特定技能2号は支援計画が不要な点、日本語要件は分野による点も説明してください。",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );
}
