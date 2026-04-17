/**
 * generate_reason_letter — 申請理由書テンプレート生成
 *
 * 特定活動（つなぎビザ）や在留資格変更許可申請で必要な「申請理由書」を
 * パターンIDと申請人情報に基づいてAIが下書き生成する。
 *
 * 対象パターン:
 * - CHANGE_TOKKATSU_A/B/C/D: 特定活動への変更（つなぎビザ）
 * - CHANGE_SSW1_D: 転職による変更
 * - その他、入管から追加提出を求められるケース
 *
 * 生成される理由書は入管の審査官向けの丁寧な日本語で、
 * 申請の背景・経緯・理由を論理的に説明する。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";
import { generateText, isVertexAIAvailable } from "../lib/vertex-ai.js";
import { createClient } from "@supabase/supabase-js";
import { calculatePatternStats } from "./track-submission-outcome.js";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");

// ──────────────────────────────────────────────────
// テンプレート定義
// ──────────────────────────────────────────────────

interface ReasonLetterTemplate {
  title: string;
  description: string;
  required_context: string[];
  optional_context: string[];
  structure: string[];
  sample_body: string;
  cautions: string[];
}

const LETTER_TEMPLATES: Record<string, ReasonLetterTemplate> = {
  // 留学 → 特定活動（特定技能準備）
  CHANGE_TOKKATSU_A: {
    title: "在留資格変更許可申請 理由書（留学 → 特定活動）",
    description: "留学生が特定技能1号の準備のため特定活動に変更する申請理由書",
    required_context: [
      "applicant_name", "nationality", "current_visa", "current_school",
      "graduation_date", "target_company", "target_industry", "exam_status",
    ],
    optional_context: [
      "exam_pass_date", "japanese_level", "internship_experience",
      "reason_for_field_choice", "future_plan",
    ],
    structure: [
      "1. 申請人の現在の在留状況（学校名・在籍状況）",
      "2. 卒業・修了後の進路（特定技能1号を目指す理由）",
      "3. 内定先企業の情報と雇用契約の状況",
      "4. 試験の合格状況または受験予定",
      "5. 特定活動が必要な理由（在留期限との関係）",
      "6. 今後の計画と申請人の誠意",
    ],
    sample_body: `謹啓　時下ますますご清祥のこととお慶び申し上げます。

この度、下記申請人について在留資格変更許可申請を行いましたので、その理由をご説明申し上げます。

【申請人情報】
氏名：{applicant_name}
国籍：{nationality}
現在の在留資格：留学
現在の在留期限：{current_visa_expiry}

【変更の理由】
申請人は現在、{current_school}に在籍しており、{graduation_date}に卒業予定です。卒業後は{target_industry}分野の特定技能1号の在留資格を取得し、{target_company}にて就労することを希望しております。

{exam_status_detail}

しかしながら、特定技能1号の在留資格変更許可申請に必要な書類の準備に時間を要するため、在留期限までに申請が間に合わない見込みです。そのため、書類準備期間として「特定活動」への在留資格変更を申請するものです。

申請人は在学中、{japanese_level}の日本語能力を有しており、日本での就労に向けて真摯に準備を進めております。特定活動の在留資格が許可されましたら、速やかに特定技能1号への変更申請手続きを進めてまいります。

何卒ご審査のほど、よろしくお願い申し上げます。

敬白`,
    cautions: [
      "資格外活動の週28時間制限を超過していないか確認すること",
      "退学の場合は退学証明書も必要",
      "在留期限まで余裕がある場合は特定技能への直接変更を推奨",
    ],
  },

  // 技能実習1号/2号 → 特定活動（つなぎビザ）
  CHANGE_TOKKATSU_B: {
    title: "在留資格変更許可申請 理由書（技能実習 → 特定活動）",
    description: "技能実習生が特定技能準備のため特定活動に変更する申請理由書",
    required_context: [
      "applicant_name", "nationality", "current_visa", "training_company",
      "training_field", "training_completion_date", "target_company", "target_industry",
    ],
    optional_context: [
      "exam_status", "same_field", "training_evaluation", "future_plan",
    ],
    structure: [
      "1. 申請人の技能実習の状況（実施機関・分野・期間）",
      "2. 技能実習修了・満了の状況",
      "3. 特定技能1号への移行を希望する理由",
      "4. 試験免除の該当状況（同一分野の場合）",
      "5. 特定活動が必要な理由（準備期間としての必要性）",
      "6. 今後の計画",
    ],
    sample_body: `謹啓　時下ますますご清祥のこととお慶び申し上げます。

この度、下記申請人について在留資格変更許可申請を行いましたので、その理由をご説明申し上げます。

【申請人情報】
氏名：{applicant_name}
国籍：{nationality}
現在の在留資格：{current_visa}
現在の在留期限：{current_visa_expiry}

【変更の理由】
申請人は{training_company}にて{training_field}分野の技能実習{current_visa_level}を実施しており、{training_completion_date}に修了{training_status}です。

技能実習{current_visa_level}を良好に修了{training_status_verb}ことから、同一分野である{target_industry}分野の特定技能1号への移行を希望しております。{exam_exemption_note}

移行先の{target_company}とは既に雇用契約を締結しており、就労条件も合意に至っております。しかしながら、特定技能1号への在留資格変更許可申請に必要な書類の準備が在留期限までに完了しない見込みであるため、準備期間としての「特定活動」への変更を申請するものです。

特定活動の在留資格が許可されましたら、速やかに必要書類を整え、特定技能1号への変更申請に進む所存です。

何卒ご審査のほど、よろしくお願い申し上げます。

敬白`,
    cautions: [
      "技能実習を中断している場合は理由の詳細な説明が必要",
      "技能実習先と特定技能の受入れ先が異なる場合は追加説明が必要",
      "実習実施者（または監理団体）からの修了証明書が必須",
    ],
  },

  CHANGE_TOKKATSU_C: {
    title: "在留資格変更許可申請 理由書（技能実習2号 → 特定活動）",
    description: "技能実習2号から特定活動に変更する申請理由書",
    required_context: [
      "applicant_name", "nationality", "current_visa", "training_company",
      "training_field", "training_completion_date", "target_company", "target_industry",
    ],
    optional_context: ["exam_status", "same_field", "future_plan"],
    structure: [
      "1. 技能実習2号の実施状況",
      "2. 修了・満了の状況と良好修了の証明",
      "3. 特定技能1号への移行理由",
      "4. 試験免除の状況",
      "5. 特定活動が必要な理由",
      "6. 今後の計画",
    ],
    sample_body: `（{CHANGE_TOKKATSU_B}のテンプレートを技能実習2号用に調整して使用）`,
    cautions: [
      "良好修了とは：技能実習を2年10ヶ月以上中断なく実施したこと",
      "同一分野であれば技能試験・日本語試験ともに免除",
    ],
  },

  CHANGE_TOKKATSU_D: {
    title: "在留資格変更許可申請 理由書（特定技能1号 → 特定活動・転職準備）",
    description: "特定技能1号から転職準備のため特定活動に変更する申請理由書",
    required_context: [
      "applicant_name", "nationality", "current_visa",
      "previous_company", "previous_industry", "resignation_date", "resignation_reason",
      "target_company", "target_industry",
    ],
    optional_context: ["new_contract_date", "job_search_status", "future_plan"],
    structure: [
      "1. 申請人の現在の在留状況",
      "2. 退職の経緯と理由",
      "3. 新しい就労先の状況",
      "4. 特定活動が必要な理由",
      "5. 今後の計画",
    ],
    sample_body: `謹啓　時下ますますご清祥のこととお慶び申し上げます。

この度、下記申請人について在留資格変更許可申請を行いましたので、その理由をご説明申し上げます。

【申請人情報】
氏名：{applicant_name}
国籍：{nationality}
現在の在留資格：特定技能1号
現在の在留期限：{current_visa_expiry}

【変更の理由】
申請人は{previous_company}にて{previous_industry}分野の特定技能1号として就労しておりましたが、{resignation_date}付けで同社を退職いたしました。

退職の理由は{resignation_reason}です。

退職後、申請人は新たな就労先として{target_company}（{target_industry}分野）との雇用契約を{new_contract_status}。しかしながら、特定技能1号の在留資格変更許可申請（新しい受入れ機関への変更）に必要な書類の準備に時間を要するため、準備期間としての「特定活動」への変更を申請するものです。

なお、申請人は退職後、在留資格に基づく活動を行っていないことを申し添えます。特定活動の在留資格が許可されましたら、速やかに特定技能1号（新受入れ機関）への変更申請手続きを進めてまいります。

何卒ご審査のほど、よろしくお願い申し上げます。

敬白`,
    cautions: [
      "退職理由が自己都合の場合は詳細な説明が必要",
      "退職後に不法就労がないことを明記すること",
      "会社都合退職の場合はハローワークでの求職活動状況も記載推奨",
      "新しい就労先が未決定の場合は求職活動の状況を説明",
    ],
  },

  // 転職（特定技能1号→特定技能1号 別企業）
  CHANGE_SSW1_D: {
    title: "在留資格変更許可申請 補足理由書（転職・受入れ機関変更）",
    description: "特定技能1号内での転職（受入れ機関変更）時に添付する補足理由書",
    required_context: [
      "applicant_name", "nationality",
      "previous_company", "previous_industry", "resignation_date", "resignation_reason",
      "target_company", "target_industry",
    ],
    optional_context: ["same_field", "new_contract_date", "future_plan"],
    structure: [
      "1. 申請人の現在の在留状況と前受入れ機関の情報",
      "2. 退職の経緯と理由",
      "3. 新しい受入れ機関との雇用関係",
      "4. 業務内容の変更点（ある場合）",
      "5. 今後の就労計画",
    ],
    sample_body: `謹啓　時下ますますご清祥のこととお慶び申し上げます。

この度、下記申請人について在留資格変更許可申請を行いましたので、受入れ機関の変更理由をご説明申し上げます。

【申請人情報】
氏名：{applicant_name}
国籍：{nationality}
現在の在留資格：特定技能1号（{previous_industry}分野）
在留カード番号：{residence_card_number}

【前受入れ機関】
{previous_company}
退職日：{resignation_date}
退職理由：{resignation_reason}

【新受入れ機関】
{target_company}
業務内容：{target_industry}分野
雇用契約締結日：{new_contract_date}

【変更の理由】
{reason_detail}

新受入れ機関である{target_company}は{target_industry}分野における適正な受入れ体制を整えており、申請人の特定技能に係る活動を適切に管理する能力を有しております。

何卒ご審査のほど、よろしくお願い申し上げます。

敬白`,
    cautions: [
      "同一分野内の転職であれば追加の試験は不要",
      "異なる分野への転職は新たな技能試験の合格が必要",
      "前雇用主からの退職証明書の取得を忘れないこと",
      "転職先が派遣の場合は派遣先の情報も記載すること",
    ],
  },

  // 汎用理由書（追加提出要求対応）
  GENERIC: {
    title: "申請理由書（追加提出用）",
    description: "入管から追加提出を求められた場合に使用する汎用理由書",
    required_context: ["applicant_name", "nationality", "reason_for_submission"],
    optional_context: ["additional_details", "reference_number"],
    structure: [
      "1. 申請の経緯",
      "2. 追加提出の理由",
      "3. 補足説明",
    ],
    sample_body: `謹啓　時下ますますご清祥のこととお慶び申し上げます。

{reason_for_submission}

何卒ご審査のほど、よろしくお願い申し上げます。

敬白`,
    cautions: [
      "入管からの追加資料提出通知の受付番号がある場合は必ず記載すること",
    ],
  },
};

// ──────────────────────────────────────────────────
// 理由書生成ロジック
// ──────────────────────────────────────────────────

function generateReasonLetter(params: {
  pattern_id: string;
  context: Record<string, string>;
  custom_reason?: string;
  language?: string;
}) {
  const { pattern_id, context, custom_reason, language = "ja" } = params;

  // Find template
  const template = LETTER_TEMPLATES[pattern_id] || LETTER_TEMPLATES.GENERIC;
  const pattern = ruleSets.application_patterns[pattern_id];

  // Check required context
  const missingRequired = template.required_context.filter(
    (f) => !context[f] || context[f].trim() === ""
  );
  const missingOptional = template.optional_context.filter(
    (f) => !context[f] || context[f].trim() === ""
  );

  // Perform placeholder substitution
  let body = template.sample_body;
  if (pattern_id === "CHANGE_TOKKATSU_C") {
    // Use B template as base for C
    body = LETTER_TEMPLATES.CHANGE_TOKKATSU_B.sample_body;
  }

  // Replace placeholders with actual values
  for (const [key, value] of Object.entries(context)) {
    const placeholder = new RegExp(`\\{${key}\\}`, "g");
    body = body.replace(placeholder, value);
  }

  // Handle special auto-fill logic
  if (context.current_visa?.includes("技能実習2号")) {
    body = body.replace("{current_visa_level}", "2号");
    if (!context.exam_exemption_note) {
      const sameField = context.same_field === "true" || context.same_field === "はい";
      const exemptionNote = sameField
        ? "技能実習2号を良好に修了したため、同一分野の技能試験および日本語試験（N4相当）については免除される見込みです。"
        : "技能実習2号を良好に修了しておりますが、異なる分野への移行であるため、当該分野の技能試験への合格が必要となります。";
      body = body.replace("{exam_exemption_note}", exemptionNote);
    }
  } else if (context.current_visa?.includes("技能実習1号")) {
    body = body.replace("{current_visa_level}", "1号");
  }

  // Handle training status verb forms
  body = body.replace("{training_status}", context.training_completion_date ? "済み" : "予定");
  body = body.replace("{training_status_verb}", context.training_completion_date ? "した" : "する見込みである");

  // Handle contract status
  if (context.new_contract_date) {
    body = body.replace("{new_contract_status}", `${context.new_contract_date}付けで雇用契約を締結しております`);
  } else {
    body = body.replace("{new_contract_status}", "雇用契約の締結に向けて協議中です");
  }

  // Handle exam status detail
  if (context.exam_status) {
    body = body.replace("{exam_status_detail}", context.exam_status);
  } else {
    body = body.replace("{exam_status_detail}", "");
  }

  // Handle resignation reason detail
  if (custom_reason) {
    body = body.replace("{reason_detail}", custom_reason);
  } else if (context.resignation_reason) {
    body = body.replace("{reason_detail}",
      `申請人は${context.resignation_reason}により前受入れ機関を退職し、新たに${context.target_company}との雇用契約を締結いたしました。`
    );
  }

  // Clean up remaining unreplaced placeholders
  body = body.replace(/\{[a-z_]+\}/g, "＿＿＿＿");

  // Add date header
  const today = new Date().toISOString().slice(0, 10);
  const formattedDate = `令和${new Date().getFullYear() - 2018}年${new Date().getMonth() + 1}月${new Date().getDate()}日`;

  const fullLetter = [
    `${formattedDate}`,
    "",
    "出入国在留管理局 御中",
    "",
    template.title,
    "",
    body,
    "",
    `作成日: ${today}`,
    context.representative ? `申請取次者: ${context.representative}` : "",
  ].filter(Boolean).join("\n");

  // Calculate completion
  const totalPlaceholders = template.required_context.length + template.optional_context.length;
  const filledPlaceholders = totalPlaceholders - missingRequired.length - missingOptional.length;
  const completionRate = Math.round((filledPlaceholders / totalPlaceholders) * 100);

  return {
    status: missingRequired.length === 0 ? "ok" : "incomplete",
    pattern_id,
    pattern_name: pattern?.formal_name || "不明",
    template_title: template.title,
    letter: fullLetter,
    completion_rate: `${completionRate}%`,
    structure: template.structure,
    missing_required: missingRequired.length > 0 ? missingRequired : undefined,
    missing_optional: missingOptional.length > 0 ? missingOptional : undefined,
    cautions: template.cautions,
    available_templates: Object.keys(LETTER_TEMPLATES).map((k) => ({
      pattern_id: k,
      title: LETTER_TEMPLATES[k].title,
    })),
    _ai_instructions:
      "📝 申請理由書を以下の形式で表示してください：\n\n" +
      "## 生成された申請理由書\n" +
      "```\n理由書の本文をコードブロックで表示\n```\n\n" +
      "## 完成度\n" +
      `- 完成率: ${completionRate}%\n` +
      (missingRequired.length > 0
        ? `- ⚠️ **必須情報が${missingRequired.length}件不足しています** — テンプレートに「＿＿＿＿」が残っている箇所は手動で記入が必要です\n`
        : "") +
      "\n## 注意事項\n" +
      template.cautions.map((c) => `- ⚡ ${c}`).join("\n") +
      "\n\n## 次のステップ\n" +
      "- 不足情報があれば追加ヒアリングを提案\n" +
      "- 完成した理由書は印刷して申請書類に添付、またはオンライン申請で添付ファイルとしてアップロード",
    _next_actions: [
      ...(missingRequired.length > 0
        ? [{ action: "ask_user", reason: `必須情報${missingRequired.length}件の追加ヒアリング`, missing: missingRequired }]
        : []),
      { tool: "get_required_documents", reason: "他の必要書類もチェック" },
      { tool: "pre_submission_checklist", reason: "提出前の最終チェック" },
    ],
  };
}

// ──────────────────────────────────────────────────
// ツール登録
// ──────────────────────────────────────────────────

export function registerGenerateReasonLetter(server: McpServer) {
  server.tool(
    "generate_reason_letter",
    "【申請理由書テンプレート生成】特定活動（つなぎビザ）や転職変更の申請で必要な「申請理由書」を自動生成。パターンIDと申請人情報を渡すと、入管の審査官向けの丁寧な日本語で申請背景・経緯・理由を論理的に説明した理由書テンプレートを出力。留学→特定活動、技能実習→特定活動、転職準備の各パターンに対応。不足情報のマーキングと注意事項の付記あり。 / Generates a formal reason letter template for visa status change applications.",
    {
      pattern_id: z.string().describe(
        "申請パターンID（例: 'CHANGE_TOKKATSU_A', 'CHANGE_SSW1_D', 'GENERIC'）。\n" +
        "利用可能なテンプレート:\n" +
        "- CHANGE_TOKKATSU_A: 留学→特定活動\n" +
        "- CHANGE_TOKKATSU_B: 技能実習1号→特定活動\n" +
        "- CHANGE_TOKKATSU_C: 技能実習2号→特定活動\n" +
        "- CHANGE_TOKKATSU_D: 特定技能1号→特定活動（転職準備）\n" +
        "- CHANGE_SSW1_D: 特定技能1号→特定技能1号（転職）\n" +
        "- GENERIC: 汎用理由書"
      ),
      context: z.record(z.string()).describe(
        "理由書に反映するコンテキスト情報（キー/値ペア）。\n" +
        "共通: applicant_name, nationality, current_visa, current_visa_expiry\n" +
        "留学系: current_school, graduation_date, exam_status\n" +
        "実習系: training_company, training_field, training_completion_date, same_field\n" +
        "転職系: previous_company, resignation_date, resignation_reason\n" +
        "共通: target_company, target_industry"
      ),
      custom_reason: z.string().optional().describe(
        "カスタム理由文。テンプレートの「変更の理由」セクションを上書きしたい場合に指定。"
      ),
      use_ai: z.boolean().optional().default(false).describe(
        "true にすると Gemini AI が申請人の状況に合わせて理由書を専門的にリライト。テンプレートの穴埋めではなく、行政書士レベルの本格的な理由書を生成。"
      ),
      language: z.enum(["ja"]).default("ja").describe(
        "出力言語（現在は日本語のみ対応）"
      ),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async (params) => {
      const templateResult = generateReasonLetter(params);

      // AI強化モード
      if (params.use_ai && isVertexAIAvailable()) {
        try {
          const aiLetter = await generateAIReasonLetter(
            params.pattern_id,
            params.context,
            templateResult
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                ...templateResult,
                letter: aiLetter,
                ai_enhanced: true,
                _ai_instructions:
                  "🤖 Gemini AI が申請人の状況に最適化した理由書を生成しました。\n" +
                  "テンプレートベースではなく、審査官の心証を良くする文章に仕上げています。\n" +
                  "ユーザーに確認してもらい、必要に応じて修正してください。",
              }, null, 2),
            }],
          };
        } catch (err: any) {
          console.warn("AI reason letter generation failed, using template:", err.message);
          // テンプレート版にフォールバック
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(templateResult, null, 2),
        }],
      };
    }
  );
}

// ── Gemini AIによる理由書生成 ──
async function generateAIReasonLetter(
  patternId: string,
  context: Record<string, string>,
  templateResult: any
): Promise<string> {
  const template = LETTER_TEMPLATES[patternId] || LETTER_TEMPLATES.GENERIC;
  const pattern = ruleSets.application_patterns[patternId];

  // Supabaseから統計データを取得
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  let statsInfo = "";
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const stats = await calculatePatternStats(supabase, patternId);
      if (stats) {
        let statsStr = `【過去の審査統計と頻出補正理由のフィードバック】\n`;
        statsStr += `- 過去の補正率（追加資料要求率）: ${(stats.revision_rate * 100).toFixed(1)}%\n`;
        statsStr += `- 過去の不許可率: ${((stats.rejected / stats.total) * 100).toFixed(1)}%\n`;
        if (stats.common_revision_codes.length > 0) {
          statsStr += `- よくある入管からの指摘事項: ${stats.common_revision_codes.join(", ")}\n`;
        }
        statsStr += `\n🌟 指示: 上記の不許可・補正理由を先回りして払拭できるよう、理由書の構成を調整・強化してください。不許可リスクを軽減する「鉄板の理由書」を目指してください。`;
        statsInfo = statsStr;
      }
    } catch (e) {
      console.warn("Failed to fetch pattern stats:", e);
    }
  }

  const contextSummary = Object.entries(context)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const prompt = `あなたは日本の入管申請を専門とする行政書士です。以下の情報に基づいて、入管の審査官に提出する「申請理由書」を作成してください。

## 申請パターン
- パターン: ${patternId}
- 正式名: ${pattern?.formal_name || templateResult.template_title}
- 変更元: ${pattern?.from_visa || "不明"}
- 変更先: ${pattern?.to_visa || "不明"}

${statsInfo ? `## 不許可リスクの回避（HITLフィードバック）\n${statsInfo}\n` : ""}## 申請人の情報
${contextSummary}

## 理由書の構成（参考）
${template.structure.join("\n")}

## 注意事項
${template.cautions.join("\n")}

## 作成ルール
1. 「謹啓」で始まり「敬白」で終わる正式な書簡形式
2. 審査官が読みやすい論理的な構成
3. 申請の正当性・必要性を客観的に説明
4. 不許可リスクを避ける穏当な表現
5. 挨拶文、申請人情報、変更理由、今後の計画の順で記載
6. 約800〜1200文字程度
7. 未提供の情報は「＿＿＿＿」（下線）で示す

理由書本文のみを出力してください。JSON形式は不要です。`;

  const result = await generateText(prompt, false);
  
  // 日付ヘッダーを追加
  const formattedDate = `令和${new Date().getFullYear() - 2018}年${new Date().getMonth() + 1}月${new Date().getDate()}日`;
  
  return [
    formattedDate,
    "",
    "出入国在留管理局 御中",
    "",
    template.title,
    "",
    result.trim(),
    "",
    `作成日: ${new Date().toISOString().slice(0, 10)}`,
    context.representative ? `申請取次者: ${context.representative}` : "",
  ].filter(Boolean).join("\n");
}
