/**
 * Reusable plan card / プランカード / Kartu paket
 */
import { formatJpy } from "@/lib/format";
import type { Plan } from "@/lib/api";

const FEATURE_LABELS: Array<[keyof NonNullable<Plan["features"]>, string]> = [
  ["ocr", "在留カード OCR"],
  ["legal_search", "法令検索 (RAG)"],
  ["bulk_generation", "書類の一括生成"],
  ["annual_report", "年次報告 CSV/Excel"],
  ["audit_log", "監査ログ"],
  ["autonomous_workflow", "自律ワークフロー"],
];

export function PlanCard({
  plan,
  currentPlanKey,
  highlight,
  action,
}: {
  plan: Plan;
  currentPlanKey?: string;
  highlight?: boolean;
  action?: React.ReactNode;
}) {
  const current = currentPlanKey === plan.key;
  return (
    <div
      className={
        "flex h-full flex-col rounded-2xl border p-6 shadow-sm transition-all " +
        (highlight
          ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900")
      }
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{plan.name}</h3>
        {current ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            現在のプラン
          </span>
        ) : highlight ? (
          <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white">おすすめ</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
      <div className="mt-5">
        <span className="text-3xl font-bold">
          {plan.monthlyPriceJpy === 0 ? "無料" : formatJpy(plan.monthlyPriceJpy)}
        </span>
        {plan.monthlyPriceJpy > 0 && <span className="ml-1 text-sm text-slate-500">/月</span>}
        {plan.yearlyPriceJpy > 0 && (
          <div className="mt-1 text-xs text-slate-500">
            年払い {formatJpy(plan.yearlyPriceJpy)} ({Math.round((1 - plan.yearlyPriceJpy / (plan.monthlyPriceJpy * 12)) * 100)}% お得)
          </div>
        )}
      </div>
      <ul className="mt-5 space-y-2 text-sm">
        {FEATURE_LABELS.map(([k, label]) => (
          <li key={k} className="flex items-center gap-2">
            <Check enabled={Boolean(plan.features?.[k])} />
            <span className={plan.features?.[k] ? "" : "text-slate-400 line-through"}>{label}</span>
          </li>
        ))}
        {plan.limits?.requestsPerDay ? (
          <li className="text-xs text-slate-500">
            1 日 {plan.limits.requestsPerDay.toLocaleString()} 回まで / 1 分 {plan.limits.requestsPerMinute?.toLocaleString() ?? "?"} 回
          </li>
        ) : null}
      </ul>
      <div className="mt-auto pt-6">{action}</div>
    </div>
  );
}

function Check({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-500" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5A1 1 0 114.7 8.1l3 3 6.7-6.7a1 1 0 011.3-.1z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-300" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10 18a8 8 0 110-16 8 8 0 010 16zM6.7 6.7a1 1 0 011.4 0L10 8.6l1.9-1.9a1 1 0 011.4 1.4L11.4 10l1.9 1.9a1 1 0 11-1.4 1.4L10 11.4l-1.9 1.9a1 1 0 11-1.4-1.4L8.6 10 6.7 8.1a1 1 0 010-1.4z" clipRule="evenodd" />
    </svg>
  );
}
