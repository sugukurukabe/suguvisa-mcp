import { createClient } from "@/lib/supabase/server";
import { getMe, listPlans, type TenantSnapshot, type Plan } from "@/lib/api";
import { formatDateJp, planBadgeTone } from "@/lib/format";
import { PlanCard } from "@/components/plan-card";
import { upgradeAction, manageAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const [tenant, plans] = await Promise.all([
    accessToken ? safe(() => getMe({ accessToken })) : Promise.resolve<TenantSnapshot | null>(null),
    safe(() => listPlans()),
  ]);

  const currentPlanKey = tenant?.plan ?? "free";
  const status = tenant?.billing?.subscriptionStatus;
  const hasStripeCustomer = Boolean(tenant?.billing?.stripeCustomerId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">請求・プラン</h1>
        <p className="mt-1 text-sm text-slate-500">Stripe 経由でアップグレード・ダウングレード・解約ができます。</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">現在のサブスクリプション</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Row label="プラン" value={plans?.find((p) => p.key === currentPlanKey)?.name ?? currentPlanKey} />
          <Row
            label="ステータス"
            value={
              <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + planBadgeTone(status ?? "free")}>
                {status ?? "free"}
              </span>
            }
          />
          <Row label="次回請求日" value={formatDateJp(tenant?.billing?.currentPeriodEnd)} />
          <Row label="解約予定" value={tenant?.billing?.cancelAtPeriodEnd ? "はい" : "いいえ"} />
        </dl>

        <form action={manageAction} className="mt-6">
          <button
            type="submit"
            disabled={!hasStripeCustomer}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-brand-600 hover:text-brand-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-700"
          >
            Stripe カスタマーポータルを開く
          </button>
          {!hasStripeCustomer && (
            <p className="mt-2 text-xs text-slate-500">
              まだ Stripe 顧客情報がありません。下のプラン一覧からアップグレードすると自動的に発行されます。
            </p>
          )}
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">プランを変更</h2>
        {!plans ? (
          <p className="text-sm text-slate-500">プラン一覧を取得できませんでした。</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            {plans.map((p, i) => (
              <PlanCard
                key={p.key}
                plan={p}
                currentPlanKey={currentPlanKey}
                highlight={i === 1}
                action={
                  p.monthlyPriceJpy === 0 ? (
                    <p className="text-center text-xs text-slate-500">Free プランはサインアップで自動適用されます</p>
                  ) : !p.stripePrices?.monthly ? (
                    <p className="text-center text-xs text-amber-600">
                      Stripe Price 未設定です。サーバー側で env を設定してください。
                    </p>
                  ) : (
                    <form action={upgradeAction}>
                      <input type="hidden" name="price_id" value={p.stripePrices.monthly} />
                      <button
                        type="submit"
                        disabled={currentPlanKey === p.key}
                        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-400"
                      >
                        {currentPlanKey === p.key ? "現在のプラン" : "このプランに変更"}
                      </button>
                    </form>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
