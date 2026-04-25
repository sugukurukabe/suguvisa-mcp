# ChatGPT Apps Store 公開 — リリース Runbook

# Release runbook / Playbook rilis

壁さんが本番に出すまでの手順書。上から順に叩くだけで終わるようになっている。
Docs: [`chatgpt-form-draft.md`](./chatgpt-form-draft.md) と [`demo-script.md`](./demo-script.md) を参照。

---

## 1. Supabase 本番 DB にチケット用マイグレーションを適用

```bash
cd /Users/kabe/suguvisa-mcp/apps/mcp-server
# マイグレーションファイル: supabase/migrations/007_tickets.sql
#   - tenants.ticket_expires_at timestamptz 追加
#   - ticket_purchases テーブル作成 (RLS + deny public)
#   - idx_tenants_ticket_expires_at (partial index)

# オプション A: Supabase CLI (推奨)
supabase link --project-ref xxxxxxxxxxxx  # 未リンクなら初回のみ
supabase db push

# オプション B: psql で直接
PSQL_URL='postgresql://postgres:<pw>@<host>:5432/postgres?sslmode=require'
psql "$PSQL_URL" -f supabase/migrations/007_tickets.sql

# 確認
psql "$PSQL_URL" -c "\d public.tenants" | grep ticket_expires_at
psql "$PSQL_URL" -c "\d public.ticket_purchases"
```

## 2. Stripe 側で Ticket 用 price を作る

```bash
# Stripe CLI or ダッシュボード (モード: 本番) で:
#   Products → New product → "Case Ticket (30-day pass)"
#   Price: JPY 2,980 / One-time / unit quantity 1
#   Price ID をメモ (price_xxxxxxxxxxxx)

# (任意) Stripe CLI で作成
stripe products create --name "Case Ticket (30-day pass)"
stripe prices create \
  --product prod_xxxxxxxx \
  --currency jpy \
  --unit-amount 2980 \
  --metadata plan=ticket
```

## 3. Cloud Run に env `SUGUVISA_STRIPE_PRICE_TICKET` を追加

```bash
# Ticket 以外の env は既存を維持したいので update-env-vars を使う (set-env-vars は全上書きなので NG)
gcloud run services update suguvisa-mcp \
  --project=mcp-service-492010 \
  --region=asia-northeast1 \
  --update-env-vars="SUGUVISA_STRIPE_PRICE_TICKET=price_xxxxxxxx" \
  --quiet
```

## 4. コードをビルドしてデプロイ

```bash
cd /Users/kabe/suguvisa-mcp/apps/mcp-server

# 1. ローカルで最終ビルド + テスト (念のため)
pnpm build
pnpm test

# 2. Cloud Run へデプロイ (既存 deploy.sh は --set-env-vars で一部 env を上書きするので、
#    必ず直後に `gcloud run services update ... --update-env-vars=...` で Ticket env を再入しなおすこと)
./deploy.sh

# 再入 (deploy.sh が --set-env-vars で上書きしたため)
gcloud run services update suguvisa-mcp \
  --project=mcp-service-492010 \
  --region=asia-northeast1 \
  --update-env-vars="SUGUVISA_STRIPE_PRICE_TICKET=price_xxxxxxxx" \
  --quiet

# ※ 長期対応: 本運用では env を Secret Manager + Cloud Run secrets mount に移行し、
#    deploy.sh から --set-env-vars を外すのが推奨。今回のリリースではインラインで ok。
```

## 5. 本番エンドポイントを検証

```bash
BASE=https://mcp.suguvisa.com

# ── CSP + 補助セキュリティヘッダ ──
curl -sI $BASE/.well-known/openai-app.json \
  | grep -iE 'content-security-policy|strict-transport-security|x-frame-options|x-content-type|referrer-policy|permissions-policy'

# 期待出力 (例):
#   content-security-policy: default-src 'none'; ... upgrade-insecure-requests
#   strict-transport-security: max-age=63072000; includeSubDomains; preload
#   x-content-type-options: nosniff
#   x-frame-options: DENY
#   referrer-policy: strict-origin-when-cross-origin
#   permissions-policy: camera=(), microphone=(), geolocation=(), ...

# ── Manifest (OpenAI スキーマ準拠 + Ticket) ──
curl -s $BASE/.well-known/openai-app.json \
  | jq '{
      schema_version,
      app_id,
      app_version,
      plans_count: (.pricing.plans | length),
      plans: (.pricing.plans | map({plan_id, price, billing_cycle})),
      one_time_passes: (.pricing.one_time_passes | map({plan_id, price, duration_days, grants_plan})),
      model: .pricing.model,
      has_csp: (.security.content_security_policy | test("default-src"))
    }'

# 期待出力の要点:
#   plans_count ≥ 3  (Free / Starter / Professional)
#   one_time_passes に {plan_id: "ticket", price: 2980, duration_days: 30, grants_plan: "starter"} が含まれる
#   model: "freemium_subscription_with_ticket"
#   has_csp: true

# ── /api/v1/billing/plans に ticket が露出しているか ──
curl -s $BASE/api/v1/billing/plans | jq '.one_time_passes'

# ── MCP 疎通 (initialize 200 OK) ──
curl -s -X POST $BASE/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <SUGUVISA_API_KEY>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"deploy-smoke","version":"0"}}}' \
  | jq '.result.serverInfo'

# ── 法務 & 公開ページ全 200 ──
for p in / /privacy /terms /security /support /health /docs; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' $BASE$p)"
done
```

## 6. Ticket 経路の E2E 確認 (壁さんの自テナントで 1 回購入)

```bash
# 1. ダッシュボード経由 (https://app.suguvisa.com/dashboard/billing) で
#    「チケットを購入する」ボタンを押す
# 2. Stripe Checkout でテスト用カード (または本番カード) で決済
# 3. 完了後 /dashboard/billing?status=ticket_success に戻る
# 4. ダッシュボードに「✅ 現在チケット有効中 — 残り約 30 日」が表示されれば OK
# 5. Supabase 側を確認:
psql "$PSQL_URL" -c "SELECT ticket_expires_at FROM tenants WHERE id='<your-tenant-id>';"
psql "$PSQL_URL" -c "SELECT * FROM ticket_purchases ORDER BY purchased_at DESC LIMIT 3;"

# 6. 実効プランが Starter になっているか (free テナントなら /api/v1/tenant/me で確認)
curl -s $BASE/api/v1/tenant/me -H 'Authorization: Bearer <API_KEY>' | jq '{
  effective_plan: .tenant.subscription_plan,
  raw: .tenant.raw_subscription_plan,
  ticket_expires_at: .tenant.ticket_expires_at,
  ticket_active: .tenant.ticket_active
}'
```

## 7. Demo MP4 をアップロード

詳細は [`demo-script.md`](./demo-script.md) 参照。

```bash
# 収録済みの demo.mp4 を配置してデプロイ
cp ~/demo.mp4 /Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/demo.mp4
cd /Users/kabe/suguvisa-mcp/apps/mcp-server
./deploy.sh

# 検証 (50MB 以下、video/mp4)
curl -sI https://mcp.suguvisa.com/assets/demo.mp4 | grep -iE '^http|content-length|content-type'
```

## 8. OpenAI Dashboard で Step 1〜6 を埋めて Submit

1. <https://platform.openai.com/> → Apps → **Create app**
2. [`chatgpt-form-draft.md`](./chatgpt-form-draft.md) §1〜§9 を順にコピペ
3. `§3-f Demo MP4 URL` に `https://mcp.suguvisa.com/assets/demo.mp4`
4. `§6-b Content Security Policy` に実際のヘッダ値（手順5の curl 出力）を貼る
5. **§6-d Policy Compliance checklist** を目視で 1 項目ずつ ✅
6. **Submit for review**

## 9. 審査中の ChatGPT 用 redirect_uri を Auth0 に登録

```text
審査開始メール / Dashboard UI に「ChatGPT will call back to」 と書かれた redirect_uri が表示される。
典型例: https://chat.openai.com/aip/g-xxxxxxxxxxxxxxx/oauth/callback

1. Auth0 Dashboard → Applications
2. DCR で自動生成された "ChatGPT ..." クライアントを開く (無ければ手動で作成)
3. Settings → Application URIs:
   - Allowed Callback URLs: 上記 URI を追加
   - Allowed Web Origins:  https://chat.openai.com
4. Advanced Settings → Grant Types: Authorization Code + Refresh Token のみ ON
5. Save
```

## 10. 公開後のクリーンアップ

- `[P2] Smithery` 再 publish (tool count / plans 同期)
- `[P2]` テストで作った Auth0 client (`H9pB...`, `aA0N...`) を削除
- `[P2]` M2M secret ローテーション

---

**Last updated**: 2026-04-25
