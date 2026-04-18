# SuguVisa Dashboard (`apps/dashboard`)

SuguVisa のテナント向け Web ダッシュボード。Next.js 14 (App Router) + Supabase SSR + Tailwind CSS。
**マーケティング / 料金 / サインアップ / API キー管理 / プラン変更 (Stripe Checkout) / 利用状況** を提供します。

## 構成 / Structure

```
apps/dashboard/
├── next.config.mjs              # standalone output (Cloud Run)
├── tailwind.config.ts
├── Dockerfile                   # 3-stage build (deps → builder → runner)
└── src/
    ├── middleware.ts            # Supabase セッション refresh + /dashboard 認証ガード
    ├── lib/
    │   ├── env.ts               # 環境変数ローダ
    │   ├── api.ts               # MCP サーバー API クライアント (listPlans / getMe /
    │   │                        #                                createCheckout / createPortal)
    │   ├── format.ts            # JPY / 日付 / バッジトーン
    │   └── supabase/
    │       ├── client.ts        # createBrowserClient
    │       ├── server.ts        # createServerClient (cookies ベース)
    │       └── middleware.ts    # セッション cookie 書き戻し
    ├── components/
    │   ├── site-chrome.tsx      # ヘッダー/フッター/ロゴ
    │   └── plan-card.tsx        # プランカード
    └── app/
        ├── layout.tsx
        ├── globals.css
        ├── (marketing)/         # / と /pricing (パブリック)
        ├── (auth)/              # /login, /signup (Supabase メール + パスワード)
        ├── auth/callback/       # Supabase PKCE callback
        └── dashboard/
            ├── layout.tsx       # getUser() → 未ログインは /login へ
            ├── page.tsx         # 概要
            ├── billing/         # Stripe Checkout / Customer Portal を叩く Server Action
            ├── api-keys/        # Supabase の `api_keys` テーブル直接管理
            └── usage/           # usage_logs + usage_daily_summary RPC
```

## ページ一覧 / Routes

| Route | 内容 | 認証 |
|---|---|---|
| `/` | ランディング (ヒーロー / 機能 / プラン / Step 3 つ) | 不要 |
| `/pricing` | 全プラン詳細 + エンタープライズ問い合わせ | 不要 |
| `/login`, `/signup` | Supabase Auth (メール+パスワード、確認メール対応) | 不要 |
| `/auth/callback` | PKCE コード → セッション変換 | 不要 |
| `/dashboard` | 現在のプラン / API エンドポイント / はじめに | 必須 |
| `/dashboard/billing` | Stripe Checkout でアップグレード / Customer Portal | 必須 |
| `/dashboard/api-keys` | キー発行・一覧・失効 (発行時 1 度だけ全文表示) | 必須 |
| `/dashboard/usage` | 直近 30 日のツール別/日別呼び出しサマリ | 必須 |

## 環境変数 / Environment variables

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS 前提) |
| `NEXT_PUBLIC_SUGUVISA_API_URL` | MCP サーバーの公開 URL (例: `https://mcp.suguvisa.com`) |
| `NEXT_PUBLIC_SITE_URL` | ダッシュボード自身の公開 URL (Stripe の success/cancel URL に使用) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (任意) クライアント側でのバリデーション用 |

`.env.example` を `.env.local` にコピーして埋めると `pnpm --filter @suguvisa/dashboard dev` で開発できます。

## 認証 / Auth

- **Supabase Auth (メール + パスワード)** を採用
- `middleware.ts` で毎リクエスト `supabase.auth.getUser()` を呼び cookie を refresh
- `/dashboard/*` アクセス時に cookie を確認し、未ログインなら `/login?next=...` にリダイレクト
- Server Components では `createClient()` (apps/dashboard/src/lib/supabase/server.ts) を使い、
  `session.access_token` を MCP サーバー API の `Authorization: Bearer` として転送

## 課金フロー / Billing flow

```
[User]  /dashboard/billing
  │
  ├─ 「このプランに変更」ボタン → upgradeAction (Server Action)
  │     └─ POST https://mcp.suguvisa.com/api/v1/billing/checkout
  │           (Authorization: Bearer <access_token>)
  │     └─ redirect(Stripe Checkout URL)
  │
  └─ 「Customer Portal を開く」 → manageAction
        └─ POST /api/v1/billing/portal
        └─ redirect(Stripe Customer Portal URL)
```

success_url / cancel_url は `NEXT_PUBLIC_SITE_URL` + `/dashboard/billing?status=...` に設定されます。Webhook 側で `tenants.subscription_status` が更新され、次回ダッシュボード表示時に反映されます。

## API キー / API keys

- `api_keys` テーブル (Supabase) に `key_hash` (SHA-256) と `key_prefix` のみ保存
- 発行時にのみ平文トークン (`svmcp_<base64url>`) を返し、ブラウザで一度だけ表示
- 失効は `revoked_at` に UTC 時刻を設定 (MCP サーバー側の auth middleware が参照)
- RLS により、テナント所属ユーザーは自分のテナントの行しか見えない前提

## ローカル開発 / Local dev

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
# Supabase プロジェクトの URL/anon key と MCP サーバー URL を埋める

pnpm install
pnpm --filter @suguvisa/billing build
pnpm --filter @suguvisa/dashboard dev   # http://localhost:3100
```

## テスト / Test

```bash
pnpm --filter @suguvisa/dashboard typecheck
pnpm --filter @suguvisa/dashboard test   # vitest: api.ts / format.ts (9 件)
pnpm --filter @suguvisa/dashboard build  # next build
```

## デプロイ / Deploy

### Cloud Run (推奨)

**重要**: `NEXT_PUBLIC_*` 変数はクライアント JS に焼き込まれるため、
Cloud Run の `--set-env-vars` ではなく **ビルド時** に渡す必要があります。
`apps/dashboard/cloudbuild.yaml` がこれを処理してくれます。

```bash
# 1. ビルド（NEXT_PUBLIC_* は client bundle に baked in）
gcloud builds submit \
  --config apps/dashboard/cloudbuild.yaml \
  --substitutions \
_NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co,\
_NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...,\
_NEXT_PUBLIC_SUGUVISA_API_URL=https://mcp.suguvisa.com,\
_NEXT_PUBLIC_SITE_URL=https://suguvisa.com \
  .

# 2. デプロイ
gcloud run deploy suguvisa-dashboard \
  --image gcr.io/$PROJECT/suguvisa-dashboard:latest \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 3100 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

### Vercel

`next.config.mjs` はそのまま動きます (output: "standalone" は Vercel では無視される)。
Root Directory を `apps/dashboard` に設定し、環境変数を Vercel Dashboard に登録するだけで OK。

## 今後 / Next

- [ ] OAuth サインイン (Google / GitHub) を Supabase Auth で追加
- [ ] Stripe Customer Portal からの解約後、タブ戻り時の状態同期を Webhook 連動で強化
- [ ] 利用状況の CSV エクスポート
- [ ] 請求書 PDF ダウンロード (Stripe 経由)
- [ ] インドネシア語 / 英語の i18n
