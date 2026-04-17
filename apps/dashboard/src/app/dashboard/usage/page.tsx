import { createClient } from "@/lib/supabase/server";
import { getUsage, type UsageSummary } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  let usage: UsageSummary | null = null;
  let error: string | null = null;
  if (accessToken) {
    try {
      usage = await getUsage({ accessToken });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  const byTool = Object.entries(usage?.byToolToday ?? {});
  const totalToday = byTool.reduce((sum, [, v]) => sum + v.success + v.error, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">利用状況</h1>
        <p className="mt-1 text-sm text-slate-500">ツール呼び出しの本日の内訳と今月の累計を確認できます。</p>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <Metric title="本日の呼び出し" value={(usage?.today ?? 0).toLocaleString()} />
        <Metric
          title="本日の残り"
          value={(usage?.todayRemaining ?? usage?.todayLimit ?? 0).toLocaleString()}
          caption={usage?.todayLimit ? `上限 ${usage.todayLimit.toLocaleString()}` : undefined}
        />
        <Metric title="今月累計" value={(usage?.thisMonth ?? 0).toLocaleString()} />
      </section>

      {error ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
          利用状況データを取得できませんでした: {error}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">本日のツール別呼び出し</h2>
        {byTool.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {usage?.mode === "local" ? "ローカルモードでは利用統計は記録されません。" : "本日はまだ呼び出しがありません。"}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {byTool
              .sort((a, b) => (b[1].success + b[1].error) - (a[1].success + a[1].error))
              .map(([name, s]) => {
                const total = s.success + s.error;
                const pct = totalToday === 0 ? 0 : Math.round((total / totalToday) * 100);
                return (
                  <li key={name} className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{name}</span>
                      <span>
                        {total.toLocaleString()} 回
                        {s.error > 0 && (
                          <span className="ml-2 text-xs text-rose-500">(うち失敗 {s.error})</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                      <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ title, value, caption }: { title: string; value: string; caption?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {caption ? <p className="mt-1 text-xs text-slate-500">{caption}</p> : null}
    </div>
  );
}
