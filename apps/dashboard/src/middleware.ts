import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

/**
 * Global middleware / グローバルミドルウェア
 *
 * - Supabase セッション cookie を毎リクエスト更新
 * - /dashboard/* は認証必須、未ログインなら /login にリダイレクト
 */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/dashboard")) {
    const supabaseAuthCookie = request.cookies.getAll().some((c) =>
      c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
    );
    if (!supabaseAuthCookie) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
