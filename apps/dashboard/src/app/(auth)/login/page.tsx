import Link from "next/link";
import { AuthForm } from "../auth-form";

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-1 text-sm text-slate-500">メールアドレスとパスワードでサインインします</p>
      </header>

      <AuthForm mode="login" next={searchParams.next} initialError={searchParams.error} />

      <p className="text-center text-sm text-slate-500">
        アカウントをお持ちでないですか？
        <Link href="/signup" className="ml-1 font-medium text-brand-600 hover:underline">新規登録</Link>
      </p>
    </div>
  );
}
