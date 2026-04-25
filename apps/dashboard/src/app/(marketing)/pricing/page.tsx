import Link from "next/link";
import { listPlans } from "@/lib/api";
import { PlanCard } from "@/components/plan-card";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await safeListPlans();

  return (
    <>
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">料金プラン</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">シンプルで透明な 3 プラン。</p>
      </header>

      {plans.length === 0 ? (
        <p className="text-center text-sm text-slate-500">料金情報を取得できませんでした。</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {plans.map((p, i) => (
            <div key={p.key} id={p.key}>
              <PlanCard
                plan={p}
                highlight={i === 1}
                action={
                  <Link
                    href={p.monthlyPriceJpy === 0 ? "/signup" : "/login?next=/dashboard/billing"}
                    className="block w-full rounded-lg bg-brand-600 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    {p.monthlyPriceJpy === 0 ? "無料で始める" : "このプランに申し込む"}
                  </Link>
                }
              />
            </div>
          ))}
        </div>
      )}

      <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">エンタープライズ / カスタムプラン</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          50 名以上の行政書士事務所・登録支援機関、専用インフラ、SLA、監査ログの長期保管などが必要な場合は個別にご相談ください。
        </p>
        <a
          href="mailto:info@sugu-kuru.co.jp?subject=SuguVisa%20Enterprise%20Inquiry"
          className="mt-4 inline-block rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/40"
        >
          お問い合わせ
        </a>
      </section>

      <section className="mt-10 text-sm text-slate-500">
        ※ 表示価格はすべて税抜。お支払いは Stripe 経由で、クレジットカード / デビットカードに対応。途中のアップグレード / ダウングレードはいつでも可能です。
      </section>
    </>
  );
}

async function safeListPlans() {
  try {
    return await listPlans();
  } catch {
    return [];
  }
}
