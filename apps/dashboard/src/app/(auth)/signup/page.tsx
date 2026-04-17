import Link from "next/link";
import { AuthForm } from "../auth-form";

export default function SignupPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-2xl font-bold">無料で始める</h1>
        <p className="mt-1 text-sm text-slate-500">メールアドレスを登録し、Free プランからスタート</p>
      </header>

      <AuthForm mode="signup" next={searchParams.next} initialError={searchParams.error} />

      <p className="text-center text-sm text-slate-500">
        すでにアカウントをお持ちですか？
        <Link href="/login" className="ml-1 font-medium text-brand-600 hover:underline">ログイン</Link>
      </p>
    </div>
  );
}
