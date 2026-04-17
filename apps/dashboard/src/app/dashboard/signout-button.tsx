"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handle() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:border-rose-400 hover:text-rose-600 dark:border-slate-700"
    >
      ログアウト
    </button>
  );
}
