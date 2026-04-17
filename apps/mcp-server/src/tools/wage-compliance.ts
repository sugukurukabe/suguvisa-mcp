import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// === 2026年度 都道府県別最低賃金（令和7年度） ===
const MINIMUM_WAGES: Record<string, number> = {
  "北海道": 1010, "青森": 955, "岩手": 952, "宮城": 973, "秋田": 951,
  "山形": 955, "福島": 955, "茨城": 1005, "栃木": 1004, "群馬": 985,
  "埼玉": 1078, "千葉": 1076, "東京": 1163, "神奈川": 1112, "新潟": 985,
  "富山": 998, "石川": 984, "福井": 984, "山梨": 988, "長野": 998,
  "岐阜": 1001, "静岡": 1034, "愛知": 1077, "三重": 1023, "滋賀": 1017,
  "京都": 1058, "大阪": 1114, "兵庫": 1052, "奈良": 986, "和歌山": 980,
  "鳥取": 957, "島根": 962, "岡山": 982, "広島": 1020, "山口": 979,
  "徳島": 955, "香川": 970, "愛媛": 956, "高知": 952, "福岡": 992,
  "佐賀": 952, "長崎": 952, "熊本": 952, "大分": 954, "宮崎": 952,
  "鹿児島": 952, "沖縄": 952,
};

// 36協定の基本上限
const OVERTIME_LIMITS = {
  monthly: 45,    // 月45時間
  yearly: 360,    // 年360時間
  special_monthly: 100,  // 特別条項でも月100時間未満
  special_yearly: 720,   // 特別条項でも年720時間
  average_80h_rule: 80,  // 2-6ヶ月平均80時間以内
};

export function registerWageCompliance(server: McpServer) {
  server.tool(
    "check_wage_compliance",
    "【給与コンプライアンスチェック】外国人スタッフの給与が①最低賃金以上か、②日本人と同等以上か、③36協定の残業上限を超えていないかを自動チェック。特定技能の在留資格要件「日本人と同等以上の報酬」の証明にも活用。 / Checks if foreign staff wages comply with minimum wage, equal pay requirements, and overtime limits.",
    {
      staff_name: z.string().optional().describe("スタッフ氏名 / Staff name"),
      prefecture: z.string().describe("都道府県名（例: '鹿児島'） / Prefecture name for minimum wage lookup"),
      hourly_wage: z.number().optional().describe("時給（円）。月給制の場合は月給と月間労働時間から計算 / Hourly wage in JPY"),
      monthly_salary: z.number().optional().describe("月給（円）。時給が未入力の場合、月間労働時間で割って時給を算出 / Monthly salary in JPY"),
      monthly_hours: z.number().optional().describe("月間所定労働時間（例: 160）。月給→時給の計算に使用 / Monthly working hours"),
      overtime_hours_monthly: z.number().optional().describe("月間残業時間 / Monthly overtime hours"),
      overtime_hours_yearly: z.number().optional().describe("年間残業時間（累計） / Yearly overtime hours"),
      japanese_avg_wage: z.number().optional().describe("同職種の日本人平均時給（比較用） / Average Japanese worker hourly wage for same job"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ staff_name, prefecture, hourly_wage, monthly_salary, monthly_hours, overtime_hours_monthly, overtime_hours_yearly, japanese_avg_wage }) => {
      const minWage = MINIMUM_WAGES[prefecture];
      if (!minWage) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: `都道府県「${prefecture}」が見つかりません`,
              available: Object.keys(MINIMUM_WAGES).join(", "),
            }, null, 2),
          }],
        };
      }

      // 時給の計算
      let calculatedHourlyWage = hourly_wage;
      if (!calculatedHourlyWage && monthly_salary && monthly_hours) {
        calculatedHourlyWage = Math.round(monthly_salary / monthly_hours);
      }

      const checks: Array<{ category: string; status: string; detail: string; severity: string }> = [];
      let overallScore = 100;

      // === チェック1: 最低賃金 ===
      if (calculatedHourlyWage) {
        const diff = calculatedHourlyWage - minWage;
        if (diff < 0) {
          checks.push({
            category: "最低賃金",
            status: "⛔ 違反",
            detail: `時給${calculatedHourlyWage}円 < ${prefecture}県最低賃金${minWage}円（${Math.abs(diff)}円不足）`,
            severity: "critical",
          });
          overallScore -= 50;
        } else if (diff < 50) {
          checks.push({
            category: "最低賃金",
            status: "⚠️ ギリギリ",
            detail: `時給${calculatedHourlyWage}円 ≥ ${prefecture}県最低賃金${minWage}円（差額${diff}円）。次の改定で最低賃金を下回る可能性`,
            severity: "warning",
          });
          overallScore -= 10;
        } else {
          checks.push({
            category: "最低賃金",
            status: "✅ OK",
            detail: `時給${calculatedHourlyWage}円 ≥ ${prefecture}県最低賃金${minWage}円（+${diff}円）`,
            severity: "ok",
          });
        }
      }

      // === チェック2: 日本人同等報酬 ===
      if (calculatedHourlyWage && japanese_avg_wage) {
        const ratio = (calculatedHourlyWage / japanese_avg_wage * 100).toFixed(1);
        if (calculatedHourlyWage < japanese_avg_wage) {
          checks.push({
            category: "同等報酬",
            status: "⛔ 違反の可能性",
            detail: `時給${calculatedHourlyWage}円 < 日本人平均${japanese_avg_wage}円（${ratio}%）。特定技能の要件「日本人と同等以上の報酬」を満たしていない可能性`,
            severity: "critical",
          });
          overallScore -= 30;
        } else {
          checks.push({
            category: "同等報酬",
            status: "✅ OK",
            detail: `時給${calculatedHourlyWage}円 ≥ 日本人平均${japanese_avg_wage}円（${ratio}%）`,
            severity: "ok",
          });
        }
      }

      // === チェック3: 36協定（残業上限） ===
      if (overtime_hours_monthly !== undefined) {
        if (overtime_hours_monthly >= OVERTIME_LIMITS.special_monthly) {
          checks.push({
            category: "36協定（月間）",
            status: "⛔ 違反",
            detail: `月間残業${overtime_hours_monthly}時間 ≥ 上限${OVERTIME_LIMITS.special_monthly}時間（特別条項でも超過不可）`,
            severity: "critical",
          });
          overallScore -= 30;
        } else if (overtime_hours_monthly > OVERTIME_LIMITS.monthly) {
          checks.push({
            category: "36協定（月間）",
            status: "⚠️ 特別条項適用",
            detail: `月間残業${overtime_hours_monthly}時間 > 通常上限${OVERTIME_LIMITS.monthly}時間。特別条項の適用が必要`,
            severity: "warning",
          });
          overallScore -= 10;
        } else {
          checks.push({
            category: "36協定（月間）",
            status: "✅ OK",
            detail: `月間残業${overtime_hours_monthly}時間 ≤ ${OVERTIME_LIMITS.monthly}時間`,
            severity: "ok",
          });
        }
      }

      if (overtime_hours_yearly !== undefined) {
        if (overtime_hours_yearly > OVERTIME_LIMITS.special_yearly) {
          checks.push({
            category: "36協定（年間）",
            status: "⛔ 違反",
            detail: `年間残業${overtime_hours_yearly}時間 > 上限${OVERTIME_LIMITS.special_yearly}時間`,
            severity: "critical",
          });
          overallScore -= 30;
        } else if (overtime_hours_yearly > OVERTIME_LIMITS.yearly) {
          checks.push({
            category: "36協定（年間）",
            status: "⚠️ 特別条項適用",
            detail: `年間残業${overtime_hours_yearly}時間 > 通常上限${OVERTIME_LIMITS.yearly}時間`,
            severity: "warning",
          });
          overallScore -= 10;
        } else {
          checks.push({
            category: "36協定（年間）",
            status: "✅ OK",
            detail: `年間残業${overtime_hours_yearly}時間 ≤ ${OVERTIME_LIMITS.yearly}時間`,
            severity: "ok",
          });
        }
      }

      overallScore = Math.max(0, overallScore);
      const criticalCount = checks.filter(c => c.severity === "critical").length;
      const warningCount = checks.filter(c => c.severity === "warning").length;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            staff_name: staff_name || "（未指定）",
            prefecture,
            minimum_wage: minWage,
            calculated_hourly_wage: calculatedHourlyWage,
            overall_score: overallScore,
            score_label: overallScore >= 90 ? "✅ 良好" : overallScore >= 70 ? "⚠️ 注意" : "🔴 要改善",
            checks,
            critical_issues: criticalCount,
            warnings: warningCount,
            next_minimum_wage_revision: "2026年10月（予定）",
            _ai_instructions: `給与コンプライアンスチェック結果を以下の形式で表示:
## 💰 給与コンプライアンスチェック
${staff_name ? `**対象**: ${staff_name}さん` : ""}
**スコア**: ${overallScore}/100 ${overallScore >= 90 ? "✅" : overallScore >= 70 ? "⚠️" : "🔴"}

| チェック項目 | 結果 | 詳細 |
|:---|:---:|:---|
${checks.map(c => `| ${c.category} | ${c.status} | ${c.detail} |`).join("\n")}

${criticalCount > 0 ? "🚨 **重大な問題があります。** 最低賃金違反は労基法違反（50万以下の罰金）、同等報酬違反はビザ更新時の不許可リスクにつながります。" : ""}
${warningCount > 0 ? "⚠️ 注意事項があります。次の最低賃金改定に備えて時給の引き上げを検討してください。" : ""}`,
          }, null, 2),
        }],
      };
    }
  );
}
