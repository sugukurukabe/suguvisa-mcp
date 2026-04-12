import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDateStr(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface BaseDeadline {
  type: string;
  description: string;
}

interface NotificationDeadline extends BaseDeadline {
  type: "随時届出";
  event_date: string;
  deadline: string;
  days_remaining: number;
  is_overdue: boolean;
  urgency: "OVERDUE" | "urgent" | "normal";
}

interface RenewalDeadline extends BaseDeadline {
  type: "更新申請";
  expiry_date: string;
  can_apply_from: string;
  can_apply_now: boolean;
  days_until_expiry: number;
  is_expired: boolean;
  urgency: "EXPIRED" | "urgent" | "soon" | "normal";
}

interface SSW1LimitDeadline extends BaseDeadline {
  type: "通算上限";
  ssw1_start_date: string;
  max_date: string;
  days_remaining: number;
  years_remaining: string;
  urgency: "EXCEEDED" | "urgent" | "normal";
}

interface COEDeadline extends BaseDeadline {
  type: "認定証明書";
  issue_date: string;
  visa_application_deadline: string;
  days_remaining: number;
  is_expired: boolean;
  urgency: "EXPIRED" | "urgent" | "soon" | "normal";
}

interface PeriodicDeadline extends BaseDeadline {
  type: "定期届出";
  period: string;
}

type Deadline = NotificationDeadline | RenewalDeadline | SSW1LimitDeadline | COEDeadline | PeriodicDeadline;

export function calculateDeadlinesData(
  params: {
    expiry_date?: string;
    event_date?: string;
    ssw1_start_date?: string;
    coe_issue_date?: string;
  },
  today: Date = new Date()
) {
  today.setHours(0, 0, 0, 0);
  const deadlines: Deadline[] = [];
  const { expiry_date, event_date, ssw1_start_date, coe_issue_date } = params;

      // 随時届出14日ルール / 14-day rule for ad-hoc notifications / Aturan 14 hari untuk pemberitahuan ad-hoc
      if (event_date) {
        const evDate = parseDateStr(event_date);
        const deadlineDate = addDays(evDate, ruleSets.deadlines["随時届出"].days as number);
        const isOverdue = deadlineDate < today;
        deadlines.push({
          type: "随時届出",
          event_date,
          deadline: fmt(deadlineDate),
          days_remaining: Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          is_overdue: isOverdue,
          description: String(ruleSets.deadlines["随時届出"].description),
          urgency: isOverdue ? "OVERDUE" : "urgent",
        });
      }

      // 更新申請可能開始日 / Renewal application start date / Tanggal mulai aplikasi perpanjangan
      if (expiry_date) {
        const expDate = parseDateStr(expiry_date);
        const canApplyFrom = addMonths(expDate, -(ruleSets.deadlines["更新申請可能開始"].months_before as number));
        const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        deadlines.push({
          type: "更新申請",
          expiry_date,
          can_apply_from: fmt(canApplyFrom),
          can_apply_now: today >= canApplyFrom,
          days_until_expiry: daysUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          description: String(ruleSets.deadlines["更新申請可能開始"].description),
          urgency: daysUntilExpiry < 0 ? "EXPIRED" : daysUntilExpiry <= 30 ? "urgent" : daysUntilExpiry <= 90 ? "soon" : "normal",
        });
      }

      // 通算在留期間チェック / Cumulative residence period check / Pemeriksaan periode tinggal kumulatif
      if (ssw1_start_date) {
        const startDate = parseDateStr(ssw1_start_date);
        const maxDate = new Date(startDate);
        maxDate.setFullYear(maxDate.getFullYear() + (ruleSets.deadlines["特定技能1号通算上限"].years as number));
        const daysRemaining = Math.ceil((maxDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        deadlines.push({
          type: "通算上限",
          ssw1_start_date,
          max_date: fmt(maxDate),
          days_remaining: daysRemaining,
          years_remaining: (daysRemaining / 365).toFixed(1),
          description: String(ruleSets.deadlines["特定技能1号通算上限"].description),
          urgency: daysRemaining < 0 ? "EXCEEDED" : daysRemaining <= 180 ? "urgent" : "normal",
        });
      }

      // 認定証明書有効期限 / COE validity period / Masa berlaku COE
      if (coe_issue_date) {
        const issueDate = parseDateStr(coe_issue_date);
        const coeExpiry = addMonths(issueDate, ruleSets.deadlines["認定証明書有効期限"].months as number);
        const daysRemaining = Math.ceil((coeExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        deadlines.push({
          type: "認定証明書",
          issue_date: coe_issue_date,
          visa_application_deadline: fmt(coeExpiry),
          days_remaining: daysRemaining,
          is_expired: daysRemaining < 0,
          description: String(ruleSets.deadlines["認定証明書有効期限"].description),
          urgency: daysRemaining < 0 ? "EXPIRED" : daysRemaining <= 14 ? "urgent" : daysRemaining <= 30 ? "soon" : "normal",
        });
      }

      // 定期届出 / Periodic notification / Pemberitahuan periodik
      const currentYear = today.getFullYear();
      deadlines.push({
        type: "定期届出",
        period: `${currentYear}/${String(ruleSets.deadlines["定期届出"].period)}`,
        description: String(ruleSets.deadlines["定期届出"].description),
      });

  let ai_guidelines = "計算結果をユーザーにわかりやすく伝えてください。";
  if (deadlines.some(d => "urgency" in d && (d.urgency === "EXPIRED" || d.urgency === "OVERDUE" || d.urgency === "EXCEEDED"))) {
    ai_guidelines = "【重要】期限を超過している項目があります！ Markdownの赤色警告ブロック（> [!CAUTION] または > [!WARNING]）を使用し、直ちに行政書士や管轄の出入国在留管理局へ相談するよう強く案内してください。";
  } else if (deadlines.some(d => "urgency" in d && d.urgency === "urgent")) {
    ai_guidelines = "【注意】期限が迫っている（urgent）項目があります。Markdownのハイライト（> [!IMPORTANT]）を使って、早急な手続きの準備を推奨してください。";
  }

  return { 
    status: "ok", 
    today: fmt(today), 
    deadlines,
    _ai_summary_guidelines: ai_guidelines
  };
}

export function registerCalculateDeadlines(server: McpServer) {
  server.tool(
    "calculate_deadlines",
    "期限計算ツール。随時届出14日ルール、更新申請可能開始日、定期届出期間、通算在留期間チェック、認定証明書の有効期限を計算する。 / Deadline calculator for notifications, renewals, limitations, and COE expiry. / Kalkulator tenggat waktu untuk pemberitahuan, perpanjangan, batasan, dan kedaluwarsa COE.",
    {
      expiry_date: z.string().optional().describe("在留期限（YYYY-MM-DD） / Expiry date / Tanggal kedaluwarsa"),
      event_date: z.string().optional().describe("届出事由の発生日（YYYY-MM-DD） / Event date for notification / Tanggal kejadian untuk pemberitahuan"),
      ssw1_start_date: z.string().optional().describe("特定技能1号の通算開始日（YYYY-MM-DD） / SSW1 cumulative start date / Tanggal mulai kumulatif SSW1"),
      coe_issue_date: z.string().optional().describe("認定証明書交付日（YYYY-MM-DD） / COE issue date / Tanggal penerbitan COE"),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async (params) => {
      const result = calculateDeadlinesData(params);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
