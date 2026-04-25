# SuguVisa — Connectors / Apps Store 公開準備 / Public Launch Prep / Persiapan Peluncuran

このディレクトリは、SuguVisa MCP サーバーを **Claude Connectors Directory** と **ChatGPT Apps Store** に掲載するための必要物を一元管理します。

## 構成 / Structure

| ファイル | 内容 |
|---|---|
| [`claude-submission.md`](./claude-submission.md) | Anthropic 申請チェックリスト（技術検証用） |
| [`claude-form-draft.md`](./claude-form-draft.md) | **Claude Connectors Directory 申請フォーム下書き（コピペ可）** |
| [`chatgpt-apps-submission.md`](./chatgpt-apps-submission.md) | OpenAI 申請チェックリスト（技術検証用） |
| [`chatgpt-form-draft.md`](./chatgpt-form-draft.md) | **ChatGPT Apps Store 申請フォーム下書き（コピペ可）** |
| [`pre-launch-checklist.md`](./pre-launch-checklist.md) | 申請前に本番環境で確認する項目 |
| [`review-screenshots.md`](./review-screenshots.md) | 審査用スクリーンショット取得ガイド |
| [`../roadmap/post-launch.md`](../roadmap/post-launch.md) | 公開後ロードマップ（`list_application_patterns` 追加・pattern_id 正規化 等） |

## エンドポイント早見表 / Endpoint cheat sheet

| 種類 | URL |
|---|---|
| Landing | `/` |
| MCP Server Card (Claude) | `/.well-known/mcp/server-card.json` |
| GPT Plugin Manifest | `/.well-known/ai-plugin.json` |
| OpenAI Apps SDK Manifest | `/.well-known/openai-app.json` |
| OpenAPI | `/openapi.yaml` |
| MCP Endpoint | `/mcp` |
| Privacy | `/privacy` |
| Terms | `/terms` |
| Security | `/security` |
| Support | `/support` |
| security.txt | `/.well-known/security.txt` |
| robots / sitemap | `/robots.txt` / `/sitemap.xml` |

## 変更方法 / How to update

ディレクトリ掲載メタデータは **単一ソース** `apps/mcp-server/src/routes/directory/metadata.ts` の `buildDirectoryMetadata()` で管理されています。

- 社名 / 連絡先 / ロゴ URL / カテゴリ / スコープ / 副処理者 → `metadata.ts` を編集
- プラン情報 → `packages/billing/src/plans.ts` を編集 (両方のマニフェストに自動反映)
- 料金価格 → `packages/billing/src/plans.ts` の `PLAN_DEFINITIONS`
- プライバシー・利用規約の本文 → `apps/mcp-server/src/routes/directory/pages.ts`

## 環境変数 / Environment variables

| 変数 | デフォルト | 用途 |
|---|---|---|
| `SUGUVISA_BASE_URL` | Cloud Run URL | すべての manifest / 法務ページのベース URL |
| `SUGUVISA_MARKETING_URL` | sugu-kuru.co.jp/suguvisa | 企業サイト (publisher.website) |
| `SUGUVISA_STATUS_URL` | `${baseUrl}/status` | ステータスページ |
| `SUGUVISA_SUPPORT_EMAIL` | info@sugu-kuru.co.jp | サポート連絡先 |
| `AUTH0_DOMAIN` | (unset) | OAuth 2.1 を有効化する場合に設定 |
| `AUTH0_AUDIENCE` | `SUGUVISA_BASE_URL` | Resource indicator |
| `APP_VERSION` | 0.9.4 | manifest の version |
