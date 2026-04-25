import { createClient } from "@/lib/supabase/server";
import {
  getMe,
  listOneTimePasses,
  listPlans,
  type OneTimePass,
  type Plan,
  type TenantSnapshot,
} from "@/lib/api";
import { formatDateJp, planBadgeTone } from "@/lib/format";
import { PlanCard } from "@/components/plan-card";
import { upgradeAction, manageAction, ticketAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const [tenant, plans, passes] = await Promise.all([
    accessToken ? safe(() => getMe({ accessToken })) : Promise.resolve<TenantSnapshot | null>(null),
    safe(() => listPlans()),
    safe(() => listOneTimePasses()),
  ]);

  const currentPlanKey = tenant?.plan ?? "free";
  const rawSubscriptionPlan = tenant?.rawSubscriptionPlan ?? currentPlanKey;
  const status = tenant?.billing?.subscriptionStatus;
  const hasStripeCustomer = Boolean(tenant?.billing?.stripeCustomerId);
  const ticketActive = Boolean(tenant?.ticketActive);
  const ticketExpiresAt = tenant?.ticketExpiresAt ?? null;
  // サブスクが starter 以上ならチケットは実質的に価値なし（重複購入を抑止）
  // When subscription is starter+, ticket provides no extra value
  const subscriptionGrantsFullAccess =
    rawSubscriptionPlan === "starter" ||
    rawSubscriptionPlan === "professional" ||
    rawSubscriptionPlan === "unlimited";

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

      <TicketSection
        passes={passes}
        ticketActive={ticketActive}
        ticketExpiresAt={ticketExpiresAt}
        subscriptionGrantsFullAccess={subscriptionGrantsFullAccess}
      />

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

/**
 * ワンタイムチケット (30日パス) セクション。
 * One-time ticket (30-day pass) purchase section.
 *
 * サブスクを契約したくないカスタマーがスポット的に Starter 相当の機能を
 * 使うための導線。すでに Starter 以上のサブスクがある場合は
 * 重複購入を抑止するため強調せず、情報表示のみに留める。
 */
function TicketSection({
  passes,
  ticketActive,
  ticketExpiresAt,
  subscriptionGrantsFullAccess,
}: {
  passes: OneTimePass[] | null;
  ticketActive: boolean;
  ticketExpiresAt: string | null;
  subscriptionGrantsFullAccess: boolean;
}) {
  if (!passes || passes.length === 0) return null;
  const pass = passes.find((p) => p.key === "ticket") ?? passes[0];
  const remainingDays = ticketExpiresAt
    ? Math.max(0, Math.ceil((new Date(ticketExpiresAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <section className="rounded-2xl border border-brand-300 bg-brand-50 p-6 dark:border-brand-800 dark:bg-brand-950/40">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-prose">
          <h2 className="text-lg font-semibold">
            {pass.name} <span className="text-brand-700">¥{pass.priceJpy.toLocaleString("ja-JP")}</span>
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{pass.description}</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <li>・有効期間: <strong>{pass.durationDays} 日</strong> (使い切り / no auto-renew)</li>
            <li>・付与される機能レベル: <strong>{pass.grantsPlan}</strong> 相当の全ツール</li>
            <li>・自動更新なし。必要なときに必要なだけ。</li>
          </ul>
          {ticketActive && (
            <p className="mt-3 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
              ✅ 現在チケット有効中 — 残り約 <strong>{remainingDays}</strong> 日
              （{formatDateJp(ticketExpiresAt)} まで）
            </p>
          )}
          {subscriptionGrantsFullAccess && (
            <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              ℹ️ すでに Starter 以上のサブスクリプションをご利用中のため、
              このチケットを追加購入しても新しく得られる機能はありません。
            </p>
          )}
        </div>
        <form action={ticketAction} className="md:min-w-[200px]">
          <input type="hidden" name="pass_key" value={pass.key} />
          <button
            type="submit"
            disabled={!pass.stripePriceId}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {ticketActive ? "チケットを追加購入 (+30日)" : "チケットを購入する"}
          </button>
          {!pass.stripePriceId && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Stripe Price 未設定です。サーバー側で
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-slate-800">
                SUGUVISA_STRIPE_PRICE_TICKET
              </code>
              を設定してください。
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">決済は Stripe。JPY (消費税込)。領収書は自動発行。</p>
        </form>
      </div>
    </section>
  );
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
