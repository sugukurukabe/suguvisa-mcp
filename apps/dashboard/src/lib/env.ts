/**
 * 環境変数ローダー / Env loader / Pemuat variabel lingkungan
 *
 * 必要な env を一箇所で検証する。build 時に失敗すべきものは
 * Next.js の build で即時エラーになるよう参照する。
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: process.env.NEXT_PUBLIC_SUGUVISA_API_URL ?? "https://mcp.suguvisa.com",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://suguvisa.com",
} as const;

export function assertConfigured(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

export function isConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
