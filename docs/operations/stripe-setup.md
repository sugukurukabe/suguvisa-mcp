# Stripe 課金の本番化手順 / Stripe go-live runbook

SuguVisa MCP / Dashboard で Stripe による SaaS 課金を動かすまでの手順。
`@suguvisa/billing` の seed CLI を使い、Product / Price の作成から Webhook
疎通確認までを冪等に実行できます。

## 前提 / Prerequisites

- Stripe アカウントが存在する (ダッシュボード上で Japan / JPY が有効化済み)
- `sk_test_...` と `sk_live_...` を取得済み
- `suguvisa-mcp` をビルド可能なローカル環境 (`pnpm install` 済み)
- Cloud Run に MCP サーバーが既にデプロイされている (ステージング OK)

## 全体フロー / End-to-end flow

```
  [1] Stripe Dashboard で Webhook 受信用 signing secret を発行
  [2] pnpm --filter @suguvisa/billing build
  [3] seed --dry-run で計画を確認
  [4] seed で Product + Price を idempotent に作成
  [5] 出力された env を Cloud Run に反映 (SUGUVISA_STRIPE_PRICE_*)
  [6] STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET も Cloud Run に設定
  [7] Stripe Dashboard で Webhook エンドポイント登録
  [8] verify で /health と /api/v1/billing/plans が green になるか確認
  [9] ダッシュボードから Test Mode 決済を 1 件流し tenants 行が更新されるか確認
  [10] Live mode に切り替え
```

## 1. Webhook signing secret の発行

Stripe Dashboard → Developers → Webhooks → **Add endpoint**

- Endpoint URL: `https://<本番ドメイン>/api/v1/billing/webhook`
- Events to send (最低限):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- 作成後 `whsec_...` をコピーする (後で `STRIPE_WEBHOOK_SECRET` に入れる)

> Test mode と Live mode は Webhook endpoint も別々に必要です。最初は Test mode で動かします。

## 2. シード CLI のビルド

```bash
pnpm install
pnpm --filter @suguvisa/billing build
```

## 3. dry-run で計画を確認 (Stripe にはアクセスしない)

```bash
node packages/billing/dist/cli.js seed --dry-run
```

出力例 (Stripe に一切触れないオフライン実行):

```
▶ SuguVisa Stripe seed (test, dry-run)
  2 products / 4 prices planned

  ＋ product SuguVisa Starter        → prod_DRYRUN_starter  (created)
  ＋ product SuguVisa Professional   → prod_DRYRUN_professional  (created)
  ＋ price  Starter (月額)           → price_DRYRUN_starter_month
  ＋ price  Starter (年額)           → price_DRYRUN_starter_year
  ＋ price  Professional (月額)      → price_DRYRUN_professional_month
  ＋ price  Professional (年額)      → price_DRYRUN_professional_year

─── Env vars to set on the MCP server ───
SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY=price_DRYRUN_starter_month
SUGUVISA_STRIPE_PRICE_STARTER_YEARLY=price_DRYRUN_starter_year
SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_DRYRUN_professional_month
SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_DRYRUN_professional_year
```

## 4. seed を実行 (Stripe に実際に作成)

```bash
export STRIPE_SECRET_KEY=sk_test_XXXXXX
node packages/billing/dist/cli.js seed
```

- 既存の Product / Price は `metadata.suguvisa_plan` と `lookup_key` で検出され再利用されます (冪等)
- 何度実行しても OK
- Live 運用時は `STRIPE_SECRET_KEY=sk_live_...` + `--allow-live` を必ずセット

出力末尾の `SUGUVISA_STRIPE_PRICE_*` を控えてください。

## 5. Cloud Run に env を反映

```bash
gcloud run services update suguvisa-mcp \
  --region asia-northeast1 \
  --update-env-vars "\
STRIPE_SECRET_KEY=sk_test_XXXX,\
STRIPE_WEBHOOK_SECRET=whsec_XXXX,\
SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY=price_...,\
SUGUVISA_STRIPE_PRICE_STARTER_YEARLY=price_...,\
SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...,\
SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_..."
```

> Secret Manager を使う場合は `--set-secrets` に置き換えてください (本番必須)。

Dashboard (`suguvisa-dashboard`) 側では課金関連 env は不要ですが、念のため
`NEXT_PUBLIC_SUGUVISA_API_URL=https://<本番ドメイン>` が正しいか確認してください。

## 6. verify CLI で疎通確認

```bash
node packages/billing/dist/cli.js verify \
  --url https://mcp.suguvisa.com \
  --stripe-key sk_test_XXXX
```

全チェックが ✅ であれば準備完了です:

```
▶ verifying https://mcp.suguvisa.com ...
  ✅ health.billing.status                 configured
  ✅ billing/plans.reachable               3 plans
  ✅ plan(starter).monthly_price_id        price_1NaAaA...
  ✅ plan(starter).yearly_price_id         price_1NaAaB...
  ✅ plan(professional).monthly_price_id   price_1NaAaC...
  ✅ plan(professional).yearly_price_id    price_1NaAaD...
  ✅ stripe.lookup(suguvisa_starter_monthly) price_1NaAaA... (19800 JPY, month)
  ...
🎉 all checks passed
```

`--stripe-key` を渡さなくても `/health` と `/billing/plans` の整合性は取れます。

## 7. エンド to エンドのテスト決済

1. `apps/dashboard` を開き、Supabase のテストユーザーでログイン
2. `/dashboard/billing` → Starter 月額「このプランに変更」を押下
3. Stripe Checkout で [Stripe のテストカード](https://stripe.com/docs/testing) `4242 4242 4242 4242` を入力
4. 成功後 `/dashboard/billing?status=success` に戻る
5. Supabase: `select subscription_status, subscription_current_period_end from tenants where id = '<自分のテナント>';` で `active` を確認
6. `billing_events` テーブルに Stripe event id が入っていること (冪等保証)

うまくいかない場合:
- Cloud Run のログで `[billing] webhook failed:` を検索
- Stripe Dashboard → Webhooks → 該当 endpoint の「Recent deliveries」で response body 確認

## 8. Live mode 切替

1. Live mode の Webhook endpoint を Stripe Dashboard で追加し `whsec_...` を再発行
2. `STRIPE_SECRET_KEY=sk_live_...` と新しい `STRIPE_WEBHOOK_SECRET` を Cloud Run に反映
3. `seed --allow-live` を 1 回だけ実行 (live 環境でも Product/Price を作成)
4. verify を再実行し全 ✅ を確認
5. 社内テストカード (もしくは検証用の実カード) で 1 件決済テスト

## 9. Cloudflare ドメインマッピング (補助メモ)

Stripe 設定とは独立ですが、本番公開前に必要。
詳細手順は [`docs/operations/domain-setup.md`](./domain-setup.md) を参照。

ドメイン構成:

| ドメイン | Cloud Run サービス |
|---|---|
| `suguvisa.com` / `www.suguvisa.com` | `suguvisa-dashboard` |
| `mcp.suguvisa.com` | `suguvisa-mcp` |

1. `docs/operations/domain-setup.md` の手順で Cloud Run にドメインマッピングを作成
2. `curl -I https://mcp.suguvisa.com/health` / `curl -I https://suguvisa.com/` が 200 を返すこと
3. Stripe の Webhook URL を `https://mcp.suguvisa.com/api/v1/billing/webhook` に更新
4. `SUGUVISA_BASE_URL=https://mcp.suguvisa.com` / `NEXT_PUBLIC_SUGUVISA_API_URL=https://mcp.suguvisa.com` / `NEXT_PUBLIC_SITE_URL=https://suguvisa.com` を Cloud Run にセット

## 付録: プランカタログを変更したら

`packages/billing/src/plans.ts` を更新したら:

1. `pnpm --filter @suguvisa/billing build && pnpm --filter @suguvisa/billing test`
2. `node packages/billing/dist/cli.js seed --dry-run` で差分確認
3. `seed` で Stripe 側に反映 (新しい Price は `lookup_key` で発行、旧 Price は active のまま残る)
4. 旧 Price を使わなくなった場合は Stripe Dashboard から archive する
5. `SUGUVISA_STRIPE_PRICE_*` env を更新 → Cloud Run redeploy

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `health.billing.status = disabled` | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / 4 つの `SUGUVISA_STRIPE_PRICE_*` のいずれかが未設定 |
| Checkout ボタンが灰色のまま | 該当プランの `stripePrices.monthly` が null。seed のやり直し or env 更新 |
| Webhook が 400 で落ちる | `STRIPE_WEBHOOK_SECRET` が古い、または Test/Live が食い違い。Stripe Dashboard から再発行 |
| `billing_events` に行が増えない | Cloud Run → express.raw の middleware が webhook より後に mount されていないか |
| `tenants.subscription_status` が更新されない | Webhook ペイロードの `customer` が tenants.stripe_customer_id と一致しない。`POST /checkout` 初回で正しく記録されているか確認 |
