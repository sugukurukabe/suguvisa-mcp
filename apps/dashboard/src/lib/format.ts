/**
 * Formatters / フォーマッタ / Pemformat
 */
export function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function formatDateJp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function planBadgeTone(status: string | null | undefined): string {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "past_due":
    case "unpaid":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
    case "canceled":
    case "incomplete_expired":
      return "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}
