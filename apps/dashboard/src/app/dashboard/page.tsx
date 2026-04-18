import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMe, listPlans, type TenantSnapshot, type Plan } from "@/lib/api";
import { formatDateJp, planBadgeTone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const [tenant, plans] = await Promise.all([
    accessToken ? safe(() => getMe({ accessToken })) : Promise.resolve<TenantSnapshot | null>(null),
    safe(() => listPlans()) as Promise<Plan[] | null>,
  ]);

  const currentPlan = plans?.find((p) => p.key === (tenant?.plan ?? "free"));
  const status = tenant?.billing?.subscriptionStatus ?? "free";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">ようこそ、SuguVisa へ</h1>
        <p className="mt-1 text-sm text-slate-500">Claude / ChatGPT / Cursor から使える業務用ビザ申請 AI。</p>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <Card
          title="現在のプラン"
          value={currentPlan?.name ?? tenant?.plan ?? "Free"}
          tone={planBadgeTone(status)}
          footer={
            <Link href="/dashboard/billing" className="text-sm text-brand-600 hover:underline">
              プランを管理 →
            </Link>
          }
        />
        <Card
          title="ステータス"
          value={status}
          tone={planBadgeTone(status)}
          footer={
            tenant?.billing?.currentPeriodEnd ? (
              <span className="text-sm text-slate-500">次回請求: {formatDateJp(tenant.billing.currentPeriodEnd)}</span>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )
          }
        />
        <Card
          title="API エンドポイント"
          value={<span className="font-mono text-sm">/mcp</span>}
          footer={
            <Link href="/dashboard/api-keys" className="text-sm text-brand-600 hover:underline">
              API キーを作成 →
            </Link>
          }
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">はじめに / Getting started</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm text-slate-700 dark:text-slate-200">
          <li>
            <Link href="/dashboard/api-keys" className="text-brand-600 hover:underline">API キーを作成</Link>
            して <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">Authorization: Bearer ...</code> で MCP サーバーに接続します。
          </li>
          <li>
            Claude Desktop の設定に以下の MCP サーバーを追加: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{apiUrl()}/mcp</code>
          </li>
          <li>
            ChatGPT では Apps SDK 経由で <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">/.well-known/openai-app.json</code> を登録します。
          </li>
          <li>
            Professional プランへアップグレードすると、在留カード OCR / 監査ログ / 一括書類生成が使えます。
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/60 dark:bg-amber-950/40">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">ご注意</h2>
        <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
          本サービスの情報は参考であり、法的助言を構成するものではありません。最終的な申請判断は弁護士または行政書士にご相談ください。
        </p>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  tone,
  footer,
}: {
  title: string;
  value: React.ReactNode;
  tone?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={
            "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold " +
            (tone ?? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200")
          }
        >
          {value}
        </span>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function apiUrl(): string {
  return (process.env.NEXT_PUBLIC_SUGUVISA_API_URL ?? "https://mcp.suguvisa.com").replace(/\/$/, "");
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
