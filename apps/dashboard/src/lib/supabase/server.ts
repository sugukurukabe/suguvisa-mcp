/**
 * Supabase server client (for Server Components / Route Handlers / Server Actions)
 * Supabase サーバークライアント / Klien server Supabase
 *
 * @supabase/ssr の推奨パターンに従い、cookies() ベースで SSR に対応する。
 */
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { env } from "../env";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components cannot set cookies; ignore to allow read-only usage.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Intentional no-op in RSC contexts.
        }
      },
    },
  });
}
