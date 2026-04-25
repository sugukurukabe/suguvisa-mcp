# Stripe 課金 / Stripe Billing / Penagihan Stripe

SuguVisa MCP のサブスクリプション課金を Stripe Billing で運用するための
セットアップ手順と内部設計。

## 目次 / Contents

1. アーキテクチャ概要
2. Stripe ダッシュボードの設定
3. 環境変数
4. Supabase マイグレーション
5. Webhook 登録
6. 動作確認
7. 内部設計 (パッケージ構造)
8. 運用 FAQ

---

## 1. アーキテクチャ概要

```
┌────────────┐     Checkout      ┌────────────┐
│  Customer  │ ───────────────▶ │   Stripe   │
└────────────┘                   └─────┬──────┘
      │  ▲                             │ Webhook
      │  │ /api/v1/billing/checkout    ▼ /api/v1/billing/webhook
      │  │ /api/v1/billing/portal      │
      │  │                             │
      ▼  │                             ▼
┌────────────────────────────────────────────┐
│        suguvisa-mcp (Cloud Run)            │
│  ┌────────────┐   ┌──────────────────────┐ │
│  │  routes/   │ → │  @suguvisa/billing   │ │
│  │  billing   │   │  (plans / client /   │ │
│  │            │   │   webhook handler)   │ │
│  └────────────┘   └──────────┬───────────┘ │
│                              ▼              │
│                    Supabase (tenants /      │
│                    billing_events)          │
└────────────────────────────────────────────┘
```

- サーバーは Stripe を呼ぶ薄いオーケストレーション層に徹し、ビジネスロジック
  (プラン特定・冪等化・永続化) は `@suguvisa/billing` と
  `SupabaseBillingRepository` に閉じ込めている。
- Webhook は event.id で冪等に処理され、`billing_events` テーブルに
  すべてのイベントが監査記録として残る。
- プラン変更は `tenants.subscription_plan` を更新し、既存の `plans.ts` /
  `rate-limiter.ts` / `isToolAllowed` がそのまま利用される。

## 2. Stripe ダッシュボードの設定

### 2.1 Product / Price の作成

テストモードで以下の 2 製品 × 2 インターバルの Price を作成する。

| Product name | Billing | Price | Lookup key (任意) |
|---|---|---|---|
| SuguVisa Starter | Recurring / Monthly | ¥19,800 JPY | `starter_monthly` |
| SuguVisa Starter | Recurring / Yearly | ¥198,000 JPY | `starter_yearly` |
| SuguVisa Professional | Recurring / Monthly | ¥49,800 JPY | `pro_monthly` |
| SuguVisa Professional | Recurring / Yearly | ¥498,000 JPY | `pro_yearly` |

作成後に `price_1xxxxx...` で始まる Price ID をメモしておく。

### 2.2 Customer Portal の有効化

Stripe ダッシュボード → Billing → Customer portal を開き、以下を設定する。

- 顧客がサブスクリプションをキャンセルできる
- 顧客が支払い方法を更新できる
- 顧客が支払い履歴を閲覧できる
- サブスクリプションの切り替え: Starter ⇄ Professional を許可する
  (各プランの monthly / yearly Price をすべて選択)

### 2.3 Tax ID collection (推奨)

日本法人向けに法人番号・インボイス登録番号を集めるため、
Settings → Tax → Tax ID collection を有効にする。

## 3. 環境変数

Cloud Run / ローカルの `.env` に以下を設定する。

```bash
# Stripe API (test mode の sk_test_... を使う。本番は sk_live_...)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Price IDs (2.1 で作成したもの)
SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY=price_1xxxx
SUGUVISA_STRIPE_PRICE_STARTER_YEARLY=price_1xxxx
SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_1xxxx
SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_1xxxx

# 公開 URL (Checkout の success/cancel URL や Portal の return URL で使う)
SUGUVISA_BASE_URL=https://app.sugu-kuru.co.jp
```

`STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` が両方セットされていない
場合、サーバーは自動的に `FakeBillingClient` にフォールバックする
(テスト / ローカル開発向け)。

## 4. Supabase マイグレーション

`apps/mcp-server/supabase/migrations/002_billing.sql` を当てる。

```bash
supabase db push
# or:
psql $SUPABASE_DB_URL -f apps/mcp-server/supabase/migrations/002_billing.sql
```

追加されるカラム / テーブル:

- `tenants.stripe_customer_id` / `stripe_subscription_id` / `stripe_price_id`
- `tenants.subscription_status` / `subscription_current_period_end` /
  `subscription_cancel_at_period_end` / `subscription_updated_at`
- `billing_events` — 冪等性のための監査テーブル
- `trg_tenants_updated_at` — `updated_at` の自動更新トリガ

## 5. Webhook 登録

### 5.1 本番

Stripe ダッシュボード → Developers → Webhooks → Add endpoint:

- URL: `https://<your-domain>/api/v1/billing/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- 作成後に表示される `Signing secret` を `STRIPE_WEBHOOK_SECRET` に設定。

### 5.2 ローカル開発

```bash
stripe login
stripe listen --forward-to localhost:3000/api/v1/billing/webhook
```

`stripe listen` が表示する `whsec_xxx` を `.env` の
`STRIPE_WEBHOOK_SECRET` に入れて起動する。

## 6. 動作確認

### 6.1 プラン一覧 (認証不要)

```bash
curl http://localhost:3000/api/v1/billing/plans | jq .
```

Stripe Price ID が環境変数から解決されて `stripe.monthly_price_id` /
`stripe.yearly_price_id` に含まれる。

### 6.2 Checkout セッション作成 (認証要)

```bash
curl -X POST http://localhost:3000/api/v1/billing/checkout \
  -H "Authorization: Bearer $SUGUVISA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "price_id": "price_1xxx_starter_monthly",
    "success_url": "https://app.sugu-kuru.co.jp/billing/success",
    "cancel_url": "https://app.sugu-kuru.co.jp/billing/cancel"
  }'
```

レスポンスの `checkout_url` にブラウザでアクセスして test card
(`4242 4242 4242 4242`) で決済すると、Webhook 経由で
`tenants.subscription_plan` が自動で `starter` / `professional` に変わる。

### 6.3 Customer Portal

```bash
curl -X POST http://localhost:3000/api/v1/billing/portal \
  -H "Authorization: Bearer $SUGUVISA_API_KEY" \
  -d '{"return_url":"https://app.sugu-kuru.co.jp/settings/billing"}'
```

## 7. 内部設計

```
packages/billing/src/
  plans.ts          プランカタログ / PLAN_DEFINITIONS / PriceMapping
  stripe-client.ts  BillingClient インターフェース + Stripe 実装
  fake.ts           テスト用の FakeBillingClient
  webhook.ts        Stripe Event → BillingIntent の純関数
```

- **`BillingClient`** は Stripe SDK を薄くラップした抽象。テストでは
  `FakeBillingClient`、本番では `StripeBillingClient` が使われる。
- **`processStripeEvent`** は副作用を持たず、Event を `BillingIntent`
  (union 型) に変換するだけ。これにより Stripe モックを使わない
  ユニットテストが書ける。
- **`BillingRepository`** が `applyIntent` を実装し、SugukuruOS では
  `SupabaseBillingRepository` が tenants / billing_events を更新する。
- **冪等性** は `billing_events.stripe_event_id UNIQUE` で保証。
  同じ event を 2 度受けても副作用は 1 回だけ。

## 8. 運用 FAQ

### プランを追加 / 改定したい

1. `packages/billing/src/plans.ts` の `PLAN_DEFINITIONS` を編集。
2. Stripe で Price を作成し、環境変数 (`SUGUVISA_STRIPE_PRICE_...`)
   にマッピングを追加。
3. `apps/mcp-server/src/lib/plans.ts` は自動同期する (変更不要)。

### Stripe キーが未設定だとどうなる

`FakeBillingClient` に自動フォールバックする。Webhook は 503 を返し、
`/billing/plans` は Price ID が null のまま返る。これにより開発環境では
Stripe なしでも他の機能が正常動作する。

### タックスインボイスを発行したい

Stripe 側で Tax Registrations を登録すると、Checkout で自動的に
インボイス番号付きの領収書が発行される (適格請求書等保存方式対応)。

### 契約 Enterprise プランはどう扱う

`unlimited` プラン (publiclyListed=false) を手動で付与する。
請求書払いは Stripe の `send_invoice` モードで個別対応。
