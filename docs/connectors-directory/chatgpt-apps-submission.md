# ChatGPT Apps Store (Apps SDK) 申請チェックリスト

参考:
- <https://platform.openai.com/docs/apps-sdk>
- <https://platform.openai.com/docs/apps-sdk/submission>

## A. 事前要件 / Prerequisites

- [ ] OpenAI Platform アカウント (platform.openai.com)
- [ ] Organization verification 完了 (発行元企業として)
- [ ] ChatGPT Apps Developer Program へのオプトイン

## B. 技術要件 / Technical

- [ ] `/.well-known/openai-app.json` が返る — **実装済み**
- [ ] `connection.type` が `mcp`、`mcp_server_url` が HTTPS で到達可能
- [ ] `/.well-known/ai-plugin.json` も保持 (後方互換) — **実装済み**
- [ ] OpenAPI 3.1 仕様 `/openapi.yaml` — **実装済み**
- [ ] OAuth 2.1 Authorization Code + PKCE (Apps Store はほぼ必須)
- [ ] Scope がマニフェストと一致
- [ ] すべてのツールで JSON Schema を提供
- [ ] `content_rating` を設定 (general / teen / mature)

## C. マニフェスト確認項目 / Manifest fields

`curl https://<domain>/.well-known/openai-app.json | jq .` で以下を確認:

- [ ] `app_id` が一意 (lowercase, alphanumeric + ハイフン)
- [ ] `name` / `localized_names` (ja/en/id)
- [ ] `tagline` ≤ 60 chars / `localized_taglines`
- [ ] `description` 200–2000 chars / `localized_descriptions`
- [ ] `categories` に OpenAI 承認済みカテゴリ
- [ ] `icon_url` が 512x512 PNG (推奨) または SVG
- [ ] `screenshots` が 3 枚以上 (1280x800 推奨)
- [ ] `legal.privacy_policy_url` / `legal.terms_of_service_url`
- [ ] `support.email` が実在アドレス
- [ ] `pricing.currency` / `pricing.plans` 設定済

## D. OpenAI Apps Store 申請フォーム

OpenAI の申請コンソールで以下を入力:

1. **App name**: `SuguVisa — Japan SSW Visa AI`
2. **App ID**: `suguvisa-mcp` (小文字 / ハイフン可)
3. **Developer**: `Sugukuru Inc.`
4. **Category**: `Business`, `Legal`
5. **Short tagline** (60 chars): `Full automation for Japan's SSW visa applications.`
6. **Description**: (`openai-app.json` の `description`)
7. **Manifest URL**: `https://<domain>/.well-known/openai-app.json`
8. **MCP Server URL**: `https://<domain>/mcp`
9. **OpenAPI URL**: `https://<domain>/openapi.yaml`
10. **Icon**: `https://<domain>/logo.svg` → ストア表示用に 1024x1024 PNG も用意
11. **Screenshots**: 3–5 枚
12. **Privacy**: `https://<domain>/privacy`
13. **Terms**: `https://<domain>/terms`
14. **Support email**: `support@sugu-kuru.co.jp`
15. **Pricing**: freemium (Free / ¥19,800 / ¥49,800)
16. **OAuth client**: OpenAI から redirect_uri を受領後、Auth0 で ChatGPT 用クライアント作成

## E. 申請前の自動チェック

```bash
# Apps manifest
curl -s https://<domain>/.well-known/openai-app.json | jq '{app_id, name, legal, pricing: .pricing.plans | length}'

# GPT plugin (classic)
curl -s https://<domain>/.well-known/ai-plugin.json | jq '{name_for_human, api}'

# OpenAPI
curl -s https://<domain>/openapi.yaml | head -5

# MCP initialize smoke test
curl -s -X POST https://<domain>/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
```

## F. レビュー観点 / What reviewers check

- ツール群が一つの明確な目的に沿っているか (bloatware 不可)
- 誤操作による不可逆的な動作が無いか (書類生成の最終提出等には確認プロンプト)
- 金銭的操作 (課金プラン変更) には追加確認を挟んでいるか
- PII の扱いが Privacy Policy と一致しているか
- エラー時に適切な自然言語で復帰できるか
- ブランドガイドライン (OpenAI ロゴ / ChatGPT の名称を誤用していないか)

## G. よくあるリジェクト理由

- manifest と実 MCP server の tool 一覧が一致していない
- screenshots が placeholder (実データでない)
- description が誇大広告 (保証できない成果を謳う)
- privacy policy が英語しかない / ChatGPT ユーザーに関する記述がない
- pricing.plans の価格が通貨混在
