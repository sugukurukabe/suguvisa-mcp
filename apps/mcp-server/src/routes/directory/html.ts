/**
 * HTML shared layout / 共通テンプレート / Template bersama
 *
 * 外部審査で「サイトがまともに見えるか」が意外と重要なので、最低限の
 * ブランディング・アクセシビリティ・モバイル対応を備えた SSR HTML を返す。
 */
import { buildDirectoryMetadata } from "./metadata.js";

export interface LayoutOptions {
  title: string;
  description: string;
  lang?: "ja" | "en" | "id";
  canonicalPath?: string;
  body: string;
  /** Suppress the header/footer (used by the OG image / raw fragments) */
  chromeless?: boolean;
}

export function layout(opts: LayoutOptions): string {
  const meta = buildDirectoryMetadata();
  const lang = opts.lang ?? "ja";
  const canonical = opts.canonicalPath ? `${meta.urls.baseUrl}${opts.canonicalPath}` : meta.urls.baseUrl;

  const header = opts.chromeless
    ? ""
    : `
    <header class="site-header">
      <a class="brand" href="/">
        <img src="${meta.urls.logo}" alt="SuguVisa" width="32" height="32" />
        <span>SuguVisa</span>
      </a>
      <nav>
        <a href="/">${lang === "ja" ? "ホーム" : lang === "id" ? "Beranda" : "Home"}</a>
        <a href="/privacy">${lang === "ja" ? "プライバシー" : lang === "id" ? "Privasi" : "Privacy"}</a>
        <a href="/terms">${lang === "ja" ? "利用規約" : lang === "id" ? "Ketentuan" : "Terms"}</a>
        <a href="/security">${lang === "ja" ? "セキュリティ" : "Security"}</a>
        <a href="/support">${lang === "ja" ? "サポート" : lang === "id" ? "Dukungan" : "Support"}</a>
        <a href="/docs">${lang === "ja" ? "ドキュメント" : lang === "id" ? "Dokumentasi" : "Docs"}</a>
      </nav>
    </header>`;

  const footer = opts.chromeless
    ? ""
    : `
    <footer class="site-footer">
      <p>© ${new Date().getFullYear()} ${meta.publisher.legalName}. All rights reserved.</p>
      <p>
        <a href="/privacy">Privacy</a> ·
        <a href="/terms">Terms</a> ·
        <a href="/security">Security</a> ·
        <a href="/support">Support</a> ·
        <a href="${meta.urls.statusPage}">Status</a> ·
        <a href="mailto:${meta.publisher.supportEmail}">${meta.publisher.supportEmail}</a>
      </p>
    </footer>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)} — SuguVisa</title>
  <meta name="description" content="${escapeHtml(opts.description)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="${meta.urls.favicon}" type="image/svg+xml" />
  <link rel="icon" href="${meta.urls.baseUrl}/favicon-32.png" type="image/png" sizes="32x32" />
  <link rel="apple-touch-icon" href="${meta.urls.baseUrl}/apple-touch-icon.png" />
  <meta property="og:title" content="${escapeHtml(opts.title)} — SuguVisa" />
  <meta property="og:description" content="${escapeHtml(opts.description)}" />
  <meta property="og:image" content="${meta.urls.ogImage}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <style>
    :root { --fg:#0f172a; --muted:#475569; --bg:#ffffff; --card:#f8fafc; --accent:#2563eb; --border:#e2e8f0; }
    @media (prefers-color-scheme: dark) {
      :root { --fg:#f1f5f9; --muted:#94a3b8; --bg:#020617; --card:#0f172a; --accent:#60a5fa; --border:#1e293b; }
    }
    *,*::before,*::after { box-sizing: border-box; }
    body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
      background: var(--bg); color: var(--fg); line-height: 1.65; -webkit-font-smoothing: antialiased; }
    main { max-width: 780px; margin: 0 auto; padding: 32px 20px 80px; }
    h1 { font-size: 1.75rem; margin-top: 0; }
    h2 { font-size: 1.25rem; margin-top: 2rem; }
    p, li { color: var(--fg); }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .muted { color: var(--muted); font-size: 0.9rem; }
    .site-header { max-width: 980px; margin: 0 auto; padding: 16px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid var(--border); }
    .site-header .brand { display:flex; align-items:center; gap:8px; font-weight: 600; }
    .site-header nav { display:flex; gap:16px; flex-wrap:wrap; font-size:0.9rem; }
    .site-footer { max-width: 980px; margin: 40px auto 0; padding: 20px; border-top: 1px solid var(--border); font-size:0.85rem; color: var(--muted); }
    .hero { text-align:center; padding: 48px 0 24px; }
    .hero h1 { font-size: 2.25rem; line-height: 1.2; }
    .hero p.lead { font-size: 1.1rem; color: var(--muted); max-width: 600px; margin: 12px auto 24px; }
    .cta { display:inline-block; padding: 12px 24px; background: var(--accent); color: white; border-radius: 8px; font-weight: 600; }
    .cta.secondary { background: transparent; color: var(--accent); border: 1px solid var(--accent); margin-left: 8px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin: 16px 0; }
    .plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 24px 0; }
    .plan-grid .card h3 { margin-top: 0; }
    .price { font-size: 1.5rem; font-weight: 700; }
    table { width:100%; border-collapse: collapse; margin: 16px 0; }
    table th, table td { text-align:left; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
    code { background: var(--card); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
${header}
<main>
${opts.body}
</main>
${footer}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
