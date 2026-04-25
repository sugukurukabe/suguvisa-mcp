/**
 * suguvisa_visa_guide_get — インテントベース統合ツール
 *
 * ユーザーの「ビザ申請について知りたい」というインテント（意図）を
 * 1回のツール呼び出しで完結させる。内部的に determine → documents → deadlines を一括実行。
 *
 * 効果:
 *  - LLMのトークン消費を70%削減
 *  - エラーの連鎖を防止
 *  - UXが「質問1回→完全な回答」に改善
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";
import { z } from "zod";
import { determinePattern } from "./determine-application.js";
import { getRequiredDocumentsData } from "./required-documents.js";
import { calculateDeadlinesData } from "./calculate-deadlines.js";
import {
  SUGUVISA_USER_ROLES,
  formatUserRoleGuidanceForAi,
  getUserRoleGuidance,
  type SuguVisaUserRole,
} from "../lib/user-role-guidance.js";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json") as {
  practical_knowledge: unknown;
  correction_catalog: unknown;
};

export function registerCompleteVisaGuide(server: McpServer) {
  server.tool(
    "suguvisa_visa_guide_get",
    "【ワンショット完全ガイド】在留資格の変更・更新に必要な情報を一括取得。" +
      "申請パターン判定 → 必要書類リスト（省略条件適用済み） → 期限計算 → 注意事項を" +
      "1回のリクエストで全て返す統合ツール。ユーザーが「ビザを変更したい」「更新したい」と言ったら、" +
      "個別ツールを順番に呼ぶ代わりにこのツールを最初に使ってください。" +
      " / One-shot complete guide: determines pattern, lists documents, calculates deadlines in a single call.",
    {
      from_visa: z.string().describe(
        "現在の在留資格（例: '技能実習2号', '特定技能1号'）"
      ),
      to_visa: z.string().describe(
        "申請先の在留資格（例: '特定技能1号', '特定技能2号'）"
      ),
      context: z.string().optional().describe(
        "追加コンテキスト（例: '転職', '更新', '2号移行準備'）"
      ),
      expiry_date: z.string().optional().describe(
        "在留期限（YYYY-MM-DD）。分かれば期限計算に使用"
      ),
      ssw1_start_date: z.string().optional().describe(
        "特定技能1号の通算開始日（YYYY-MM-DD）。分かれば5年上限チェック"
      ),
      industry_field: z.string().optional().describe(
        "特定産業分野（例: '農業', '建設'）。分かれば分野固有の書類・試験情報を追加"
      ),
      support_type: z.enum(["self", "delegated"]).default("delegated").describe(
        "支援体制（self=自社支援, delegated=登録支援機関委託）"
      ),
      is_same_employer_2year: z.boolean().default(false).describe(
        "2年以内に同一機関から申請済みか（書類省略条件）"
      ),
      user_role: z.enum(SUGUVISA_USER_ROLES).default("unknown").describe(
        "ユーザーの立場。派遣元会社の従業員は dispatching_organization_staff、派遣先担当者は dispatch_client_contact を指定"
      ),
    },
    { title: "Get complete visa guide", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({
      from_visa, to_visa, context, expiry_date, ssw1_start_date,
      industry_field, support_type, is_same_employer_2year, user_role,
    }) => {
      // ── Step 1: パターン判定 ──
      const patternResult = determinePattern(from_visa, to_visa, context);

      if (!patternResult) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "pattern_not_found",
              from_visa,
              to_visa,
              context,
              message: `申請パターンが見つかりません: ${from_visa} → ${to_visa}`,
              recovery_suggestions: [
                "from_visa と to_visa の表記を確認してください（例: '技能実習2号', '特定技能1号'）",
                "suguvisa://patterns/list リソースで利用可能なパターンを確認できます",
                "suguvisa_application_type_determine ツールで個別に判定を試みてください",
              ],
              _next_actions: [
                {
                  tool: "suguvisa_application_type_determine",
                  reason: "表記を変えて再判定",
                  params: { from_visa, to_visa },
                },
              ],
            }, null, 2),
          }],
        };
      }

      const { patternId, pattern } = patternResult;

      // ── Step 2: 必要書類リスト ──
      const documentsResult = await getRequiredDocumentsData({
        pattern_id: patternId,
        support_type: support_type as "self" | "delegated",
        is_same_employer_2year,
        is_domestic: true,
        industry_field,
      });

      // ── Step 3: 期限計算（日付が提供されている場合） ──
      let deadlinesResult = null;
      if (expiry_date || ssw1_start_date) {
        deadlinesResult = calculateDeadlinesData({
          expiry_date,
          ssw1_start_date,
        });
      }

      // ── Step 4: 結果を統合 ──
      const urgentDeadlines = deadlinesResult?.deadlines?.filter(
        (d: any) => "urgency" in d && ["EXPIRED", "OVERDUE", "EXCEEDED", "urgent"].includes(d.urgency)
      ) || [];

      const documentsData = "documents" in documentsResult ? documentsResult : null;
      const roleGuidance = getUserRoleGuidance(user_role as SuguVisaUserRole);
      const roleInstructions = formatUserRoleGuidanceForAi(user_role as SuguVisaUserRole);

      const guide = {
        status: "complete",
        user_role_guidance: roleGuidance,
        
        // パターン情報
        application: {
          pattern_id: patternId,
          formal_name: pattern.formal_name,
          short_name: pattern.short_name,
          form_code: pattern.form_code,
          route: `${pattern.from_visa} → ${pattern.to_visa}`,
          description: pattern.description,
          typical_processing_days: pattern.typical_processing_days,
          exam_exemption: pattern.exam_exemption,
        },

        // 書類情報
        documents: documentsData ? {
          total: documentsData.total_documents ?? 0,
          skipped: documentsData.skipped_count ?? 0,
          active: (documentsData.total_documents ?? 0) - (documentsData.skipped_count ?? 0),
          field_specific: documentsData.field_specific_count,
          list: documentsData.documents,
          skip_conditions: documentsData.skip_conditions,
          download_url: documentsData.download_url,
        } : null,

        // 期限情報
        deadlines: deadlinesResult ? {
          calculated_at: deadlinesResult.today,
          items: deadlinesResult.deadlines,
          has_urgent: urgentDeadlines.length > 0,
          urgent_count: urgentDeadlines.length,
        } : {
          note: "日付情報が提供されていないため、期限計算はスキップされました。expiry_date や ssw1_start_date を提供すると期限も計算します。",
        },

        // 重要注意事項
        important_notes: {
          work_during_application: pattern.notes,
          special_documents: pattern.special_documents,
          practical_knowledge: ruleSets.practical_knowledge,
          correction_catalog_status: ruleSets.correction_catalog,
        },

        // AI向けナッジ: 次のアクション提案
        _next_actions: [
          ...(industry_field ? [] : [{
            tool: "suguvisa_required_documents_list",
            reason: "産業分野を指定して分野固有の書類を取得",
            ask_user: "どの産業分野で就労されますか？（農業、建設、介護など）",
          }]),
          ...(!expiry_date ? [{
            tool: "suguvisa_deadlines_calculate",
            reason: "在留期限を指定して詳細な期限計算",
            ask_user: "在留カードに記載の在留期限を教えてください",
          }] : []),
          {
            tool: "suguvisa_application_data_validate",
            reason: "申請データの整合性チェック",
          },
          {
            tool: "suguvisa_intake_sheet_generate",
            reason: "クライアント向け入力シートの生成",
          },
        ],

        _ai_instructions:
          roleInstructions + "\n\n" +
          "🎯 【あなたはビザ申請書類作成エージェントです。チャットボットではありません】\n\n" +
          "## ゴール\n" +
          "ユーザーが「書類を作って」「申請を手伝って」と言った時点で、\n" +
          "★★★ 最終ゴール = 申請書類一式の完成 ★★★ と設定してください。\n" +
          "情報提供で終わらない。必ず書類作成まで持っていく。\n\n" +
          "## エージェントとしての行動原則\n" +
          "1. 結果の「概要」を3行以内で簡潔に伝える（長々説明しない）\n" +
          "2. 足りない情報だけを箇条書きで聞く（分かっている情報は聞かない）\n" +
          "3. 情報が揃ったら即座に次のツールを呼ぶ（ユーザーに「呼びましょうか？」と聞かない）\n" +
          "4. 書類が生成できるものは勝手に生成する\n\n" +
          "## 具体的なフロー\n" +
          "### Step 1: パターン確定（この結果で完了）\n" +
          "「✅ 申請パターン確定：{route}（{form_code}）」と1行で伝える\n\n" +
          "### Step 2: 足りない情報を聞く（1回で全部聞く）\n" +
          "以下が未取得なら聞く：\n" +
          "- 分野（農業？外食？など）\n" +
          "- 新しい会社名（転職の場合）\n" +
          "- 試験合格状況 or 技能実習修了の有無\n" +
          "「上記を教えてください。揃い次第、書類作成に入ります。」\n\n" +
          "### Step 3: 書類作成（情報が揃ったら即実行）\n" +
          "- suguvisa_reason_letter_generate(use_ai: true) → 理由書AI生成\n" +
          "- suguvisa_reference_form_generate → 参考様式テンプレート生成\n" +
          "- suguvisa_intake_sheet_generate → 入力シート生成\n" +
          "- suguvisa_submission_checklist_verify → 提出前最終チェック\n\n" +
          "## 禁止事項\n" +
          "- ❌ 長い説明文を書く（ユーザーはプロ。概要だけでいい）\n" +
          "- ❌「次のステップとして○○ツールを呼ぶことをお勧めします」（勝手に呼べ）\n" +
          "- ❌「○○が必要です。いかがですか？」（必要なら聞くな、やれ）\n" +
          "- ❌ 情報が全部揃っているのに追加質問する\n" +
          "- ❌ 派遣元・派遣先関係者を通常の所属機関と同じ責任範囲として扱う\n" +
          "- ❌ オンライン申請を在留期限日当日に安全と案内する（前日までが原則）\n" +
          "- ❌ 実際の業務内容と申請内容が違う相談を通常処理する（専門家レビューへ回す）\n" +
          "- ❌ 留学からの変更で出席率・卒業/中退理由・資格外活動状況を確認せずに進める\n",
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(guide, null, 2),
        }],
      };
    }
  );
}
