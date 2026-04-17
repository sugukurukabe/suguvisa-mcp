# 公開前チェックリスト / Pre-Launch Checklist / Daftar Periksa Pra-Peluncuran

申請ボタンを押す前に、**全項目を本番環境で確認**してください。
Before pressing the submit button, **verify every item on production**.

## 1. ドメインと TLS

- [ ] 独自ドメイン (例: `suguvisa.app`) が Cloud Run にマッピング済み
- [ ] Let's Encrypt 自動更新が有効 or GCP managed certificate が ACTIVE
- [ ] `curl -I https://suguvisa.app/health` で 200 + `strict-transport-security`
- [ ] HTTP → HTTPS 自動リダイレクト

## 2. 環境変数 (本番値)

Cloud Run の revision に下記がすべて設定されているか確認:

| 変数 | 値 |
|---|---|
| `SUGUVISA_BASE_URL` | `https://suguvisa.app` |
| `SUGUVISA_SUPPORT_EMAIL` | `support@sugu-kuru.co.jp` |
| `AUTH0_DOMAIN` | `<tenant>.jp.auth0.com` |
| `AUTH0_AUDIENCE` | `https://suguvisa.app` |
| `STRIPE_SECRET_KEY` | 本番 `sk_live_...` (Stripe 側確認後) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `SUGUVISA_STRIPE_PRICE_STARTER_MONTHLY` | `price_1...` |
| `SUGUVISA_STRIPE_PRICE_STARTER_YEARLY` | `price_1...` |
| `SUGUVISA_STRIPE_PRICE_PROFESSIONAL_MONTHLY` | `price_1...` |
| `SUGUVISA_STRIPE_PRICE_PROFESSIONAL_YEARLY` | `price_1...` |
| `SUPABASE_URL` | 本番プロジェクト URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 service role |
| `PII_ENCRYPTION_KEY_ID` | Cloud KMS resource name |
| `OTEL_EXPORTER` | `google` |
| `APP_VERSION` | タグと一致 (例: `0.10.0`) |

## 3. 法務ページの HTML 検証

```bash
for p in / /privacy /terms /security /support; do
  echo "=== $p ==="
  curl -s -o /dev/null -w 'status=%{http_code} size=%{size_download}\n' https://suguvisa.app$p
done
```

- [ ] すべて 200
- [ ] 本文に会社名 / 連絡先 / 最終更新日が含まれる
- [ ] モバイル (iPhone Safari) でレイアウトが崩れない

## 4. マニフェスト検証

```bash
curl -s https://suguvisa.app/.well-known/mcp/server-card.json | jq .
curl -s https://suguvisa.app/.well-known/ai-plugin.json | jq .
curl -s https://suguvisa.app/.well-known/openai-app.json | jq .
```

- [ ] `icon` / `logo_url` が 200 で返る
- [ ] `privacy_policy_url` / `terms_of_service_url` が 200
- [ ] `plans[]` に Free + Starter + Professional の 3 件
- [ ] `auth.oauth2` が null / 空でない

## 5. 認証フロー

- [ ] `curl https://suguvisa.app/.well-known/oauth-protected-resource` が 200
- [ ] Auth0 のテナントに Claude / ChatGPT 用クライアント登録
- [ ] Auth0 の Allowed Callback URL に Claude / OpenAI の redirect を追加
- [ ] スコープ (`visa:read`, `visa:write`, `visa:ocr`, `visa:audit`, `tenant:admin`) が Claude 側に表示される

## 6. MCP プロトコル疎通

```bash
npx -y @modelcontextprotocol/inspector https://suguvisa.app/mcp
```

- [ ] `tools/list` で 37 ツール返る
- [ ] `prompts/list` で 8 プロンプト返る
- [ ] `resources/list` で リソース返る
- [ ] `determine_application_type` のテスト呼び出しが成功

## 7. 決済 E2E (テストモード)

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
