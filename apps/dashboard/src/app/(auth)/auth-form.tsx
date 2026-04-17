"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
  next?: string;
  initialError?: string;
}

export function AuthForm({ mode, next, initialError }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push(next ?? "/dashboard");
        router.refresh();
      } else {
        const { error: err, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/dashboard")}`,
          },
        });
        if (err) throw err;
        if (data.user && !data.session) {
          setNotice("確認メールをお送りしました。メール内のリンクをクリックしてサインアップを完了してください。");
        } else {
          router.push(next ?? "/dashboard");
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100">
          {notice}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">メールアドレス</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">パスワード</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-slate-700 dark:bg-slate-900"
        />
        <span className="mt-1 block text-xs text-slate-500">8 文字以上、英数字を混在させてください。</span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400"
      >
        {loading ? "処理中…" : mode === "login" ? "ログイン" : "登録する"}
      </button>
    </form>
  );
}
