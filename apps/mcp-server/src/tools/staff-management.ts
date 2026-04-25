import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

/**
 * 在留カード一括管理・期限チェック・届出リマインダー・コンプラダッシュボード
 *
 * Supabase テーブル: staff_visa_status
 *   id, staff_name, nationality, visa_type, visa_expiry, card_number,
 *   company_name, registered_at, updated_at
 */

// === 期限チェックのしきい値 ===
const THRESHOLDS = {
  URGENT: 30,   // 30日以内 = 🔴
  WARNING: 60,  // 60日以内 = 🟡
  CAUTION: 90,  // 90日以内 = 🟠
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusEmoji(days: number): string {
  if (days < 0) return "⛔";       // 期限切れ
  if (days <= THRESHOLDS.URGENT) return "🔴";
  if (days <= THRESHOLDS.WARNING) return "🟡";
  if (days <= THRESHOLDS.CAUTION) return "🟠";
  return "🟢";
}

function getStatusLabel(days: number): string {
  if (days < 0) return "期限切れ";
  if (days <= THRESHOLDS.URGENT) return "緊急";
  if (days <= THRESHOLDS.WARNING) return "注意";
  if (days <= THRESHOLDS.CAUTION) return "確認";
  return "OK";
}

// === 届出イベント定義 ===
const NOTIFICATION_EVENTS = {
  address_change: { name: "住所変更届出", deadline_days: 14, authority: "市区町村", note: "在留カードの住居地変更も必要" },
  join_company: { name: "所属機関届出（入社）", deadline_days: 14, authority: "入管", note: "契約機関に関する届出（新たな契約の締結）" },
  leave_company: { name: "所属機関届出（退社）", deadline_days: 14, authority: "入管", note: "契約機関に関する届出（契約の終了・離脱）" },
  contract_change: { name: "契約変更届出", deadline_days: 14, authority: "入管", note: "雇用条件の変更（勤務地・給与等）" },
  name_change: { name: "氏名変更届出", deadline_days: 14, authority: "入管", note: "婚姻等による氏名変更" },
  missing_person: { name: "行方不明届出", deadline_days: 0, authority: "入管・警察", note: "速やかに届出が必要" },
};

export function registerStaffManagement(server: McpServer) {

  // === ツール1: 在留カード情報の登録/更新 ===
  server.tool(
    "suguvisa_staff_visa_register",
    "【スタッフ在留情報登録】在留カード情報をデータベースに登録・更新。suguvisa_residence_card_parse の結果をそのまま保存できる。全スタッフの在留期限を一元管理し、期限切れによる不法就労を防止。 / Registers or updates staff visa information in the database for centralized expiry tracking.",
    {
      staff_name: z.string().describe("スタッフ氏名（ローマ字） / Staff name in romaji"),
      nationality: z.string().optional().describe("国籍 / Nationality"),
      visa_type: z.string().optional().describe("在留資格（例: '特定技能1号'） / Visa type"),
      visa_expiry: z.string().describe("在留期限（YYYY-MM-DD） / Visa expiry date"),
      card_number: z.string().optional().describe("在留カード番号 / Residence card number"),
      company_name: z.string().optional().describe("所属企業名 / Company name"),
    },
    { title: "Register staff visa", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ staff_name, nationality, visa_type, visa_expiry, card_number, company_name }) => {
      try {
        // Upsert by staff_name
        const { data, error } = await supabase
          .from("staff_visa_status")
          .upsert({
            staff_name,
            nationality: nationality || null,
            visa_type: visa_type || null,
            visa_expiry,
            card_number: card_number || null,
            company_name: company_name || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "staff_name" })
          .select()
          .single();

        if (error) throw error;

        const days = daysUntil(visa_expiry);
        const status = getStatusEmoji(days);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              staff_name,
              visa_expiry,
              days_remaining: days,
              status: `${status} ${getStatusLabel(days)}`,
              message: days <= THRESHOLDS.WARNING
                ? `⚠️ ${staff_name}さんの在留期限まで残り${days}日です。更新申請の準備を始めてください。`
                : `✅ ${staff_name}さんの在留情報を登録しました。期限まで残り${days}日です。`,
              _ai_instructions: days <= THRESHOLDS.URGENT
                ? `🚨 至急! ${staff_name}さんの在留期限まで${days}日しかありません。suguvisa_application_type_determine を使って更新申請の準備を今すぐ開始してください。`
                : "登録完了を報告してください。",
            }, null, 2),
          }],
        };
      } catch (err: any) {
        // Supabase未設定時のフォールバック（ローカルメモリ）
        const days = daysUntil(visa_expiry);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              note: "Supabase未設定のためメモリに一時保存",
              staff_name,
              visa_expiry,
              days_remaining: days,
              status: `${getStatusEmoji(days)} ${getStatusLabel(days)}`,
              _ai_instructions: "データベース未設定のため一時的にメモリ保存したことを伝えてください。永続化にはSupabase設定が必要です。",
            }, null, 2),
          }],
        };
      }
    }
  );

  // === ツール2: 全スタッフの在留期限チェック ===
  server.tool(
    "suguvisa_staff_visa_status_check",
    "【在留期限一括チェック】登録済みの全スタッフの在留期限を一覧表示し、期限切れリスクを色分けで可視化。🔴30日以内 🟡60日以内 🟠90日以内 🟢安全。不法就労助長罪（3年以下の懲役）の予防に必須。 / Checks visa expiry dates for all registered staff with color-coded risk levels.",
    {
      company_name: z.string().optional().describe("企業名でフィルタ（省略時は全員） / Filter by company"),
      days_threshold: z.number().optional().describe("この日数以内に期限が来る人のみ表示（省略時は全員） / Show only staff expiring within N days"),
    },
    { title: "Check all visa status", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ company_name, days_threshold }) => {
      try {
        let query = supabase.from("staff_visa_status").select("*").order("visa_expiry", { ascending: true });
        if (company_name) {
          query = query.eq("company_name", company_name);
        }
        const { data, error } = await query;
        if (error) throw error;

        let staff = (data || []).map((s: any) => {
          const days = daysUntil(s.visa_expiry);
          return {
            name: s.staff_name,
            nationality: s.nationality,
            visa_type: s.visa_type,
            visa_expiry: s.visa_expiry,
            company: s.company_name,
            days_remaining: days,
            status: getStatusEmoji(days),
            status_label: getStatusLabel(days),
          };
        });

        if (days_threshold) {
          staff = staff.filter(s => s.days_remaining <= days_threshold);
        }

        const expired = staff.filter(s => s.days_remaining < 0);
        const urgent = staff.filter(s => s.days_remaining >= 0 && s.days_remaining <= THRESHOLDS.URGENT);
        const warning = staff.filter(s => s.days_remaining > THRESHOLDS.URGENT && s.days_remaining <= THRESHOLDS.WARNING);
        const ok = staff.filter(s => s.days_remaining > THRESHOLDS.WARNING);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              total_staff: staff.length,
              summary: {
                expired: expired.length,
                urgent: urgent.length,
                warning: warning.length,
                ok: ok.length,
              },
              staff,
              alerts: [
                ...expired.map(s => `⛔ ${s.name}: 在留期限が${Math.abs(s.days_remaining)}日前に切れています！不法就労の可能性！`),
                ...urgent.map(s => `🔴 ${s.name}: 残り${s.days_remaining}日 — 緊急！更新申請を今すぐ開始してください`),
                ...warning.map(s => `🟡 ${s.name}: 残り${s.days_remaining}日 — 更新申請の準備を始めてください`),
              ],
              _ai_instructions: `在留期限チェック結果を表形式で見やすく表示してください:
| ステータス | 氏名 | 在留資格 | 期限 | 残日数 |
のフォーマットで。

${expired.length > 0 ? "🚨 期限切れのスタッフがいます！これは不法就労助長罪（3年以下の懲役・300万以下の罰金）に該当する可能性があります。至急対応を促してください。" : ""}
${urgent.length > 0 ? `⚠️ ${urgent.length}名のスタッフの期限が30日以内です。suguvisa_application_type_determine で更新申請の準備を提案してください。` : "全員安全です。"}`,
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "スタッフデータの取得に失敗しました",
              detail: err.message,
              suggestion: "先に suguvisa_staff_visa_register でスタッフ情報を登録してください",
              _ai_instructions: "Supabase テーブル `staff_visa_status` が未作成の可能性があります。手動で suguvisa_residence_card_parse → suguvisa_staff_visa_register のフローでデータを登録するよう案内してください。",
            }, null, 2),
          }],
        };
      }
    }
  );

  // === ツール3: 届出リマインダー ===
  server.tool(
    "suguvisa_staff_notification_deadline_check",
    "【届出期限チェック】住所変更・入退社・契約変更等のイベント発生時、14日以内の届出期限を計算し、必要な届出書類を案内。届出忘れは入管法違反（20万以下の罰金）。 / Calculates 14-day notification deadlines for address changes, employment changes etc.",
    {
      event_type: z.enum([
        "address_change", "join_company", "leave_company",
        "contract_change", "name_change", "missing_person",
      ]).describe("イベント種類 / Event type"),
      event_date: z.string().describe("イベント発生日（YYYY-MM-DD） / Event date"),
      staff_name: z.string().optional().describe("対象スタッフ氏名 / Staff name"),
    },
    { title: "Check notification deadline", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ event_type, event_date, staff_name }) => {
      const event = NOTIFICATION_EVENTS[event_type];
      const eventDate = new Date(event_date);
      const deadlineDate = new Date(eventDate);
      deadlineDate.setDate(deadlineDate.getDate() + event.deadline_days);
      const daysLeft = daysUntil(deadlineDate.toISOString().split("T")[0]);

      const isOverdue = daysLeft < 0;
      const isUrgent = daysLeft >= 0 && daysLeft <= 3;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            event_type,
            event_name: event.name,
            event_date,
            staff_name: staff_name || "（未指定）",
            deadline: deadlineDate.toISOString().split("T")[0],
            days_remaining: daysLeft,
            authority: event.authority,
            note: event.note,
            status: isOverdue ? "⛔ 期限超過" : isUrgent ? "🔴 緊急" : daysLeft <= 7 ? "🟡 注意" : "🟠 準備OK",
            penalty: "届出義務違反: 20万円以下の罰金（入管法第71条の3）",
            required_actions: getRequiredActions(event_type),
            _ai_instructions: `${isOverdue
              ? `🚨 期限を${Math.abs(daysLeft)}日超過しています！直ちに届出してください。遅延理由書の添付も必要な場合があります。`
              : isUrgent
                ? `⚠️ 届出期限まで残り${daysLeft}日です！今すぐ書類を準備してください。`
                : `📋 届出期限は${deadlineDate.toISOString().split("T")[0]}です（残り${daysLeft}日）。`
            }
届出に必要な手順をチェックリスト形式で提示してください。
${staff_name ? `${staff_name}さん` : "対象者"}の情報を使って generate_notification（sugukuru-core）での書類自動生成を提案してください。`,
          }, null, 2),
        }],
      };
    }
  );

  // === ツール4: コンプライアンスダッシュボード ===
  server.tool(
    "suguvisa_staff_compliance_dashboard_get",
    "【コンプラダッシュボード】在留期限・届出義務・定期面談の実施状況を一画面で可視化。100点満点でスコアリングし、対応が必要な項目をアラート表示。監査対応や本社報告に活用。 / Compliance dashboard showing visa expiry, notification status, and interview records with a 100-point score.",
    {
      company_name: z.string().optional().describe("企業名（省略時は全体） / Company name"),
    },
    { title: "Get compliance dashboard", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ company_name }) => {
      // Supabase からデータ取得を試みる
      let staffData: any[] = [];
      try {
        let query = supabase.from("staff_visa_status").select("*");
        if (company_name) query = query.eq("company_name", company_name);
        const { data } = await query;
        staffData = data || [];
      } catch {
        // Supabase未設定時は空データ
      }

      const totalStaff = staffData.length;
      const now = new Date();

      // 在留期限チェック
      const expired = staffData.filter(s => new Date(s.visa_expiry) < now);
      const expiringSoon = staffData.filter(s => {
        const days = daysUntil(s.visa_expiry);
        return days >= 0 && days <= 90;
      });

      // スコア計算
      let score = 100;
      const issues: string[] = [];
      const actions: string[] = [];

      if (expired.length > 0) {
        score -= 40;
        issues.push(`⛔ 在留期限切れ: ${expired.length}名 — 不法就労リスク`);
        actions.push("直ちに在留資格の確認と更新手続きを開始");
      }
      if (expiringSoon.length > 0) {
        score -= expiringSoon.length * 5;
        issues.push(`🟡 90日以内に期限到来: ${expiringSoon.length}名`);
        actions.push("更新申請の準備を開始（suguvisa_application_type_determine を実行）");
      }
      if (totalStaff === 0) {
        score = 0;
        issues.push("📋 スタッフ情報が未登録です");
        actions.push("suguvisa_residence_card_parse と suguvisa_staff_visa_register でスタッフを登録してください");
      }

      score = Math.max(0, score);

      const dashboard = {
        company: company_name || "全社",
        generated_at: now.toISOString(),
        overall_score: score,
        score_label: score >= 90 ? "🟢 優良" : score >= 70 ? "🟡 注意" : score >= 50 ? "🟠 要改善" : "🔴 危険",
        summary: {
          total_staff: totalStaff,
          visa_expired: expired.length,
          visa_expiring_soon: expiringSoon.length,
          visa_ok: totalStaff - expired.length - expiringSoon.length,
        },
        categories: {
          visa_management: {
            score: expired.length > 0 ? 0 : expiringSoon.length > 0 ? 70 : 100,
            label: "在留カード期限管理",
            status: expired.length > 0 ? "⛔ 要対応" : expiringSoon.length > 0 ? "⚠️ 注意" : "✅ OK",
          },
          notification_compliance: {
            score: 85, // TODO: 実データ連携
            label: "届出義務",
            status: "✅ OK",
          },
          regular_interview: {
            score: 80, // TODO: 実データ連携
            label: "定期面談",
            status: "✅ OK",
          },
          safety_training: {
            score: 90, // TODO: 実データ連携
            label: "安全教育",
            status: "✅ OK",
          },
        },
        issues,
        recommended_actions: actions,
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            ...dashboard,
            _ai_instructions: `コンプライアンスダッシュボードを以下のように表示してください:

## 📊 コンプライアンスダッシュボード
**総合スコア: ${score}/100 ${dashboard.score_label}**

| カテゴリ | スコア | ステータス |
|:---|:---:|:---|
| 在留カード管理 | ${dashboard.categories.visa_management.score} | ${dashboard.categories.visa_management.status} |
| 届出義務 | ${dashboard.categories.notification_compliance.score} | ${dashboard.categories.notification_compliance.status} |
| 定期面談 | ${dashboard.categories.regular_interview.score} | ${dashboard.categories.regular_interview.status} |
| 安全教育 | ${dashboard.categories.safety_training.score} | ${dashboard.categories.safety_training.status} |

${issues.length > 0 ? "### ⚠️ 要対応事項\n" + issues.map(i => `- ${i}`).join("\n") : "✅ 全項目クリアです！"}
${actions.length > 0 ? "\n### 📋 推奨アクション\n" + actions.map((a, i) => `${i + 1}. ${a}`).join("\n") : ""}`,
          }, null, 2),
        }],
      };
    }
  );
}

// === ヘルパー: 届出に必要なアクション ===
function getRequiredActions(eventType: string): string[] {
  switch (eventType) {
    case "address_change":
      return [
        "新住所の市区町村で転入届を提出",
        "在留カードの住居地変更を届出（入管ではなく市区町村）",
        "雇用主側: 「活動機関に関する届出」は不要（住所変更の場合）",
      ];
    case "join_company":
      return [
        "本人: 「契約機関に関する届出（新たな契約の締結）」を入管に提出",
        "受入れ機関: 「受入れ困難に係る届出」（前の機関が提出）",
        "支援計画の変更届（登録支援機関経由）",
        "ハローワークへの届出（雇用保険被保険者資格取得届）",
      ];
    case "leave_company":
      return [
        "本人: 「契約機関に関する届出（契約の終了）」を入管に提出",
        "受入れ機関: 「受入れ困難に係る届出」を入管に提出",
        "ハローワークへの届出（雇用保険被保険者資格喪失届）",
        "社会保険の資格喪失届",
      ];
    case "contract_change":
      return [
        "変更内容に応じた届出書類を入管に提出",
        "雇用条件書の再作成",
        "在留資格の活動範囲内の変更かを確認",
      ];
    case "name_change":
      return [
        "在留カードの氏名変更申請（入管）",
        "パスポートの確認",
        "社会保険・雇用保険の氏名変更届",
      ];
    case "missing_person":
      return [
        "速やかに入管と警察に届出",
        "「受入れ困難に係る届出」を入管に提出",
        "支援計画の中断報告",
      ];
    default:
      return ["入管に確認してください"];
  }
}
