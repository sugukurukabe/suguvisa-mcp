# Claude Connectors Directory 申請チェックリスト

参考: <https://support.anthropic.com/en/articles/11503832-claude-connectors-directory>

## A. 事前要件 / Prerequisites

- [ ] Anthropic Developer アカウント (console.anthropic.com)
- [ ] Organization が Claude for Work / Team に加入済み
- [ ] 本番 MCP サーバーが公開 URL でアクセス可能 (`curl https://<domain>/.well-known/mcp/server-card.json` で 200)
- [ ] TLS 証明書が有効 (Let's Encrypt か Cloud Run managed)

## B. 技術要件 / Technical

- [ ] `/.well-known/mcp/server-card.json` が返る — **実装済み**
- [ ] `mcp.url` が HTTPS で到達可能で `initialize` を受け付ける — Cloud Run で確認
- [ ] OAuth 2.1 Resource Server (PKCE 必須) — `AUTH0_DOMAIN` 環境変数をセットして有効化
- [ ] Protected Resource Metadata (RFC 9728) — **実装済み** (`/.well-known/oauth-protected-resource`)
- [ ] `tools/list` / `resources/list` / `prompts/list` が正常応答
- [ ] レート制限 (per-principal) — **実装済み**
- [ ] Security.txt (RFC 9116) — **実装済み** (`/.well-known/security.txt`)

## C. ディレクトリ掲載メタデータ / Metadata

チェック方法: `curl https://<domain>/.well-known/mcp/server-card.json | jq .`

- [ ] `serverInfo.displayName` / `displayNameLocalized` (ja/en/id) 設定済
- [ ] `serverInfo.description` ≤ 200 chars
- [ ] `serverInfo.icon` が 256x256 以上の正方形 PNG or SVG
- [ ] `serverInfo.categories` に Anthropic のカテゴリ (business, productivity, legal 等)
- [ ] `links.privacyPolicy` / `termsOfService` / `support` がそれぞれ 200 で返る HTML
- [ ] `publisher.legalName` / `supportEmail` が実在する連絡先

## D. 法務要件 / Legal

- [ ] `/privacy` に個人情報保護法 (APPI) 準拠のプライバシーポリシー — **実装済み**
- [ ] `/terms` に利用規約 (免責・準拠法明記) — **実装済み**
- [ ] `/security` にデータ保管場所・暗号化・副処理者 — **実装済み**
- [ ] 副処理者 (Supabase, Stripe, GCP, Auth0) の DPA 締結確認
- [ ] 特商法表記 (日本国内サービスの場合) — `/commerce` または `/terms` に追記

## E. 申請時に提出する項目 / Submission form

Anthropic のコンソールで以下を入力:

1. **Display Name**: `SuguVisa — Japan SSW Visa AI`
2. **Publisher**: `Sugukuru Inc. (スグクル株式会社)`
3. **Contact Email**: `support@sugu-kuru.co.jp`
4. **Server URL**: `https://<your-domain>/mcp`
5. **Server Card URL**: `https://<your-domain>/.well-known/mcp/server-card.json`
6. **Categories**: `Legal`, `Business`, `Productivity`
7. **Short description**: (サーバーカードの `shortDescription.en` をコピー)
8. **Long description**: (サーバーカードの `longDescription.en`)
9. **Icon**: `https://<your-domain>/logo.svg`
10. **Privacy policy**: `https://<your-domain>/privacy`
11. **Terms of service**: `https://<your-domain>/terms`
12. **Support URL**: `https://<your-domain>/support`
13. **Status page**: `https://<your-domain>/status`
14. **Screenshots**: 3–5 枚 (詳細は [review-screenshots.md](./review-screenshots.md))
15. **OAuth client** (必要な場合): Auth0 で別途 Claude 用クライアント作成

## F. 審査前チェック / Pre-review self-check

```bash
# 1. サーバーカード / ai-plugin / openai-app
curl -s https://<domain>/.well-known/mcp/server-card.json | jq .serverInfo
curl -s https://<domain>/.well-known/ai-plugin.json | jq .name_for_human
curl -s https://<domain>/.well-known/openai-app.json | jq .app_id

# 2. 法務ページ (HTML 200 必須)
for p in / /privacy /terms /security /support; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' https://<domain>$p)"
done

# 3. MCP プロトコル疎通
npx @modelcontextprotocol/inspector https://<domain>/mcp

# 4. OAuth PRM
curl -s https://<domain>/.well-known/oauth-protected-resource | jq .
```

## G. よくあるリジェクト理由 / Common rejection reasons

- プライバシーポリシーがテンプレートのまま / 更新日がない
- ロゴが透過 PNG でない / 画質が低い
- Contact email が無効なアドレス
- OAuth flow で redirect_uri が固定されていない
- description が宣伝文句だけで、実際の機能を説明していない
- Rate limit がかかっていない / 認証が甘い
