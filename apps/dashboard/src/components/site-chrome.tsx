/**
 * Marketing/site header + footer
 * マーケティング用ヘッダ・フッタ / Header + footer situs
 */
import Link from "next/link";

export function SiteHeader({ authed = false }: { authed?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <LogoMark />
          <span>SuguVisa</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-slate-600 dark:text-slate-300 sm:flex">
          <Link href="/pricing" className="hover:text-brand-600">料金</Link>
          <Link href="/docs" className="hover:text-brand-600">ドキュメント</Link>
          <Link href="/support" className="hover:text-brand-600">サポート</Link>
        </nav>
        <div className="flex items-center gap-2">
          {authed ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                ダッシュボード
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3 py-1.5 text-sm text-slate-600 hover:text-brand-600 dark:text-slate-300">
                ログイン
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                無料で始める
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 py-10 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} スグクル株式会社 / Sugukuru Inc.</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-brand-600">Privacy</Link>
          <Link href="/terms" className="hover:text-brand-600">Terms</Link>
          <Link href="/security" className="hover:text-brand-600">Security</Link>
          <Link href="/support" className="hover:text-brand-600">Support</Link>
          <a href="mailto:support@sugu-kuru.co.jp" className="hover:text-brand-600">support@sugu-kuru.co.jp</a>
        </nav>
      </div>
    </footer>
  );
}

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="224" height="224" rx="48" fill="url(#lg)" />
      <path
        d="M82 170c0 14 14 26 42 26s42-10 42-28c0-20-16-28-42-34-20-4-30-8-30-18s10-16 26-16c14 0 24 6 26 20h24c-4-26-22-40-50-40-28 0-48 14-48 38 0 20 14 30 42 36 22 4 30 8 30 18s-10 18-28 18c-16 0-26-6-28-22z"
        fill="#fff"
      />
    </svg>
  );
}
