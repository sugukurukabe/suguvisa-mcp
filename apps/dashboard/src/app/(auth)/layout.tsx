import Link from "next/link";
import { LogoMark } from "@/components/site-chrome";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-md items-center gap-2 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <LogoMark />
            <span>SuguVisa</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-5 py-10">{children}</main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
        <Link href="/privacy" className="mx-2 hover:text-brand-600">Privacy</Link>
        <Link href="/terms" className="mx-2 hover:text-brand-600">Terms</Link>
      </footer>
    </div>
  );
}
