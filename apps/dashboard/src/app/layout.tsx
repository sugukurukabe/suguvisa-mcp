import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SuguVisa — 特定技能ビザ申請AI",
    template: "%s | SuguVisa",
  },
  description:
    "日本の特定技能ビザ申請を完全自動化。申請パターン判定・期限計算・書類生成・電子届出・年次報告まで、Claude / ChatGPT / Cursor から直接呼び出せる MCP サーバー。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "SuguVisa",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
