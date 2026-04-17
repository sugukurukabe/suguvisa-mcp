"use client";

import { useState, FormEvent } from "react";
import { issueApiKey } from "./actions";

export function ApiKeyForm({ userEmail }: { userEmail: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setToken(null);
    const data = new FormData(e.currentTarget);
    const res = await issueApiKey(data);
    setLoading(false);
    if ("token" in res) {
      setToken(res.token);
      (e.currentTarget as HTMLFormElement).reset();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="text-sm font-medium">ラベル (例: Claude Desktop)</span>
          <input
            type="text"
            name="label"
            placeholder={`${userEmail.split("@")[0]}-default`}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400"
        >
          {loading ? "発行中…" : "発行する"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-rose-500">エラー: {error}</p>
      )}

      {token && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            ⚠ この API キーは今回しか表示されません。今すぐ安全な場所にコピーしてください。
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 px-3 py-2 font-mono text-xs text-amber-100">
            {token}
          </pre>
          <CopyButton value={token} />
        </div>
      )}
    </>
  );
}

function CopyButton({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          /* noop */
        }
      }}
      className="mt-3 rounded border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
    >
      {ok ? "コピーしました" : "クリップボードにコピー"}
    </button>
  );
}
