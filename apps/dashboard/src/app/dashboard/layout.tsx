import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/site-chrome";
import { SignOutButton } from "./signout-button";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/dashboard", label: "概要" },
  { href: "/dashboard/billing", label: "請求・プラン" },
  { href: "/dashboard/api-keys", label: "API キー" },
  { href: "/dashboard/usage", label: "利用状況" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <LogoMark />
            <span>SuguVisa</span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-slate-600 hover:text-brand-600 dark:text-slate-300">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">{data.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
