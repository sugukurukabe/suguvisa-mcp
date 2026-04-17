/**
 * Landing page / ランディング / Halaman utama
 */
import Link from "next/link";
import { listPlans } from "@/lib/api";
import { PlanCard } from "@/components/plan-card";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const plans = await safeListPlans();

  return (
    <>
      <section className="py-8 text-center sm:py-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
          Claude · ChatGPT · Cursor · Smithery 対応
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          特定技能ビザ申請の煩雑さを、<br />
          <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">AI で一気通貫に</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          申請種別の自動判定・必要書類リスト・期限計算・在留カード OCR・定期届出の CSV/Excel 生成まで。37 以上の MCP ツールを業務用 AI から呼び出せます。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700">
            無料で始める
          </Link>
          <Link href="/pricing" className="rounded-xl border border-slate-300 px-5 py-3 text-base font-semibold hover:border-brand-600 dark:border-slate-700">
            料金を見る
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">クレジットカード不要・Free プランから始められます</p>
      </section>

      <section className="grid gap-6 py-10 sm:grid-cols-3">
        {[
          {
            title: "申請パターンを即判定",
            desc: "現在の在留資格 → 目標の在留資格から、変更・更新・認定・2 号移行まで全パターンを自動判定。",
          },
          {
            title: "必要書類と省略条件",
            desc: "技能実習 2/3 号からの変更、JFT/ASAT 合格、支援業務委託など、条件に応じた省略をリアルタイム適用。",
          },
          {
            title: "期限・届出を見逃さない",
            desc: "14 日届出・通算 5 年上限・更新 3 ヶ月前を計算。ChatGPT で定期届出 CSV を瞬時に出力。",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="py-12">
        <div className="mb-8 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">料金プラン</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">必要に応じて途中でアップグレード/ダウングレードできます</p>
          </div>
          <Link href="/pricing" className="text-sm text-brand-600 hover:underline">詳しく見る →</Link>
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-slate-500">料金情報を取得できませんでした。しばらくしてからお試しください。</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            {plans.slice(0, 3).map((p, i) => (
              <PlanCard
                key={p.key}
                plan={p}
                highlight={i === 1}
                action={
                  <Link
                    href={p.monthlyPriceJpy === 0 ? "/signup" : `/pricing#${p.key}`}
                    className="block w-full rounded-lg bg-brand-600 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    {p.monthlyPriceJpy === 0 ? "無料で始める" : "アップグレード"}
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 px-8 py-10 dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-2xl font-bold">使い方は 3 ステップ</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            "Claude / ChatGPT / Cursor に SuguVisa を接続",
            "「技能実習 2 号から特定技能 1 号に変更したい」と話しかける",
            "必要書類・期限・届出 CSV がチャット内で生成される",
          ].map((t, i) => (
            <li key={i} className="rounded-xl bg-white p-5 dark:bg-slate-950">
              <div className="text-brand-600 font-mono text-sm">Step {i + 1}</div>
              <p className="mt-2 text-sm">{t}</p>
            </li>
          ))}
        </ol>
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
