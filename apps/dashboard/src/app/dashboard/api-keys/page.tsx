import { createClient } from "@/lib/supabase/server";
import { listApiKeys, type ApiKeySummary } from "@/lib/api";
import { ApiKeyForm } from "./form";
import { RevokeButton } from "./revoke";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  let keys: ApiKeySummary[] = [];
  let error: string | null = null;
  if (accessToken) {
    try {
      keys = await listApiKeys({ accessToken });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">API キー</h1>
        <p className="mt-1 text-sm text-slate-500">
          MCP サーバーへのアクセスに使う Bearer トークンを管理します。発行後 1 度だけ全文が表示されます。
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">新しいキーを発行</h2>
        <ApiKeyForm userEmail={userData.user?.email ?? ""} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">発行済みキー</h2>
        {error ? (
          <p className="text-sm text-rose-500">取得に失敗しました: {error}</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-slate-500">まだキーがありません。上のフォームから発行してください。</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">ラベル</th>
                  <th className="px-4 py-3">最終利用</th>
                  <th className="px-4 py-3">発行日</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {keys.map((k) => (
                  <tr key={k.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-3 font-medium">{k.label ?? "(no label)"}</td>
                    <td className="px-4 py-3">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("ja-JP") : "未使用"}
                    </td>
                    <td className="px-4 py-3">{new Date(k.createdAt).toLocaleString("ja-JP")}</td>
                    <td className="px-4 py-3">
                      {k.status === "active" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          有効
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                          {k.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{k.status === "active" && <RevokeButton keyId={k.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
