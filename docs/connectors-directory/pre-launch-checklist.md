# 公開前チェックリスト / Pre-Launch Checklist / Daftar Periksa Pra-Peluncuran

申請ボタンを押す前に、**全項目を本番環境で確認**してください。
Before pressing the submit button, **verify every item on production**.

## 1. ドメインと TLS

本番構成:

| ドメイン | 役割 | Cloud Run サービス |
|---|---|---|
| `suguvisa.com` / `www.suguvisa.com` | マーケ + ダッシュボード | `suguvisa-dashboard` |
| `mcp.suguvisa.com` | MCP サーバー (connector endpoint) | `suguvisa-mcp` |

- [ ] Cloud Run Domain Mappings に 3 ドメインすべて ACTIVE
- [ ] managed certificate が ACTIVE (5〜30 分かかる)
- [ ] `curl -I https://mcp.suguvisa.com/health` で 200 + `strict-transport-security`
- [ ] `curl -I https://suguvisa.com/` で 200 (ダッシュボードトップ)
- [ ] HTTP → HTTPS 自動リダイレクト

## 2. 環境変数 (本番値)

Cloud Run `suguvisa-mcp` の revision に下記がすべて設定されているか確認:

| 変数 | 値 |
|---|---|
| `SUGUVISA_BASE_URL` | `https://mcp.suguvisa.com` |
| `SUGUVISA_MARKETING_URL` | `https://suguvisa.com` |
| `SUGUVISA_SUPPORT_EMAIL` | `info@sugu-kuru.co.jp` |
| `AUTH0_DOMAIN` | `<tenant>.jp.auth0.com` |
| `AUTH0_AUDIENCE` | `https://mcp.suguvisa.com` |
| `STRIPE_SECRET_KEY` | 本番 `sk_live_...` (Stripe 側確認後) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY` | `price_1...` |
| `SUGUVISA_STRIPE_PRICE_STARTER_YEARLY` | `price_1...` |
| `SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY` | `price_1...` |
| `SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY` | `price_1...` |
| `SUPABASE_URL` | 本番プロジェクト URL |
| `SUPABASE_SERVICE_KEY` | 本番 service role |
| `PII_ENCRYPTION_KEY_ID` | Cloud KMS resource name |
| `OTEL_EXPORTER` | `google` |
| `APP_VERSION` | タグと一致 (例: `0.10.0`) |

Cloud Run `suguvisa-dashboard` 側:

| 変数 | 値 |
|---|---|
| `NEXT_PUBLIC_SUGUVISA_API_URL` | `https://mcp.suguvisa.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://suguvisa.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | 本番プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |

## 3. 法務ページの HTML 検証

```bash
for p in / /privacy /terms /security /support; do
  echo "=== $p ==="
  curl -s -o /dev/null -w 'status=%{http_code} size=%{size_download}\n' https://mcp.suguvisa.com$p
done
```

- [ ] すべて 200
- [ ] 本文に会社名 / 連絡先 / 最終更新日が含まれる
- [ ] モバイル (iPhone Safari) でレイアウトが崩れない

## 4. マニフェスト検証

```bash
curl -s https://mcp.suguvisa.com/.well-known/mcp/server-card.json | jq .
curl -s https://mcp.suguvisa.com/.well-known/ai-plugin.json | jq .
curl -s https://mcp.suguvisa.com/.well-known/openai-app.json | jq .
```

- [ ] `icon` / `logo_url` が 200 で返る
- [ ] `privacy_policy_url` / `terms_of_service_url` が 200
- [ ] `plans[]` に Free + Starter + Professional の 3 件
- [ ] `auth.oauth2` が null / 空でない
- [ ] 返ってくる URL が全て `https://mcp.suguvisa.com/...` または `https://suguvisa.com/...`

## 5. 認証フロー

- [ ] `curl https://mcp.suguvisa.com/.well-known/oauth-protected-resource` が 200
- [ ] Auth0 のテナントに Claude / ChatGPT 用クライアント登録
- [ ] Auth0 の Allowed Callback URL に Claude / OpenAI の redirect を追加
- [ ] Auth0 API の Identifier = `https://mcp.suguvisa.com`
- [ ] スコープ (`visa:read`, `visa:write`, `visa:ocr`, `visa:audit`, `tenant:admin`) が Claude 側に表示される

## 6. MCP プロトコル疎通

```bash
npx -y @modelcontextprotocol/inspector https://mcp.suguvisa.com/mcp
```

- [x] `tools/list` で 42 ツール返る
- [x] `prompts/list` で 14 プロンプト返る
- [x] `resources/list` で 70 リソース返る
- [ ] `suguvisa_application_type_determine` のテスト呼び出しが成功

## 7. 決済 E2E (テストモード)

- [ ] Stripe Webhook URL = `https://mcp.suguvisa.com/api/v1/billing/webhook`
- [ ] `POST /api/v1/billing/checkout` で Stripe Checkout URL 生成
- [ ] テストカード `4242 4242 4242 4242` で決済成功
- [ ] Webhook が `checkout.session.completed` を受信し、`tenants.subscription_status=active` に更新
- [ ] `POST /api/v1/billing/portal` でカスタマーポータル URL 生成
- [ ] サブスクキャンセル → `customer.subscription.updated` → `subscription_cancel_at_period_end=true`
- [ ] テストカード失敗 `4000 0000 0000 0341` で `invoice.payment_failed` を受信

## 8. 可観測性

- [ ] Cloud Logging にアクセスログ / error が流れている
- [ ] Cloud Trace に `mcp.tool.<name>` span が出ている
- [ ] Cloud Monitoring で `mcp.tool.calls` メトリクスが可視化

## 9. セキュリティ

- [ ] Cloud Armor で rate limit / WAF ルールが有効
- [ ] 本番 API Key は Secret Manager 経由 (env 直書きなし)
- [ ] Supabase RLS がすべての表で ON
- [ ] 開発用 `SUGUVISA_API_KEY` (ローカルバイパス) が **本番では未設定**

## 10. ドキュメント

- [ ] [`docs/billing/README.md`](../billing/README.md) の環境変数が最新
- [ ] [`docs/operations/observability.md`](../operations/observability.md) のダッシュボード URL が本番を指す
- [ ] README の badge / Cloud Run URL が最新

## 11. 申請直前

- [ ] GitHub `main` ブランチがデプロイ済みリビジョンと一致
- [ ] `git tag v0.10.0` でリリースタグ作成
- [ ] スクリーンショット 3-5 枚を `/assets/screenshots/` にアップロード
- [ ] サポートメールの自動応答を設定 (24 時間以内返信の旨)

全チェック完了後、[Claude 申請](./claude-submission.md) → [ChatGPT 申請](./chatgpt-apps-submission.md) の順で提出します。
