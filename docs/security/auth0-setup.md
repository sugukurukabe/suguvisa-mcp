# Auth0 セットアップガイド / Auth0 Setup Guide / Panduan Setup Auth0

## 1. Auth0 テナント作成 / Create Auth0 Tenant

1. [Auth0 Dashboard](https://manage.auth0.com/) にログイン
2. 新しいテナントを作成:
   - Name: `suguvisa-dev`
   - Region: `JP` (or `US`)
   - Environment Tag: `Development`

## 2. Custom API の作成 / Create Custom API

1. Applications → APIs → Create API
2. 設定:
   - Name: `SuguVisa MCP Server`
   - Identifier: `https://suguvisa-mcp-731026511067.asia-northeast1.run.app`
   - Signing Algorithm: `RS256`

## 3. スコープの追加 / Add Scopes

APIs → SuguVisa MCP Server → Permissions タブで以下を追加:

```
read:visa_case           案件情報の参照
read:golden_records      ゴールデンレコードの参照
read:law_updates         法改正情報の参照
generate:reason_letter   申請理由書の生成
generate:paper_form      紙申請書マッピング
generate:bulk_xlsm       一括申請Excel
generate:annual_report   定期届出CSV
validate:application_data 申請データ検証
review:document          AI書類レビュー
write:submission_outcome 申請結果の記録
write:audit_log          監査ログの記録
admin:tenant             テナント設定の変更
admin:golden_records     ゴールデンレコードの更新
```

## 4. Auth0 Action で tenant_id を付与 / Add tenant_id Claim via Action

1. Actions → Triggers → Login / Post Login
2. カスタム Action を作成:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://suguvisa.jp';
  const tenantId = event.user.app_metadata?.tenant_id || event.user.user_id;

  api.accessToken.setCustomClaim(`${namespace}/tenant_id`, tenantId);
};
```

## 5. PKCE 設定 / PKCE Configuration

APIs → SuguVisa MCP Server → Settings:
- Token Endpoint Auth Method: `None` (for public clients using PKCE)
- Allow Cross-Origin Authentication: `ON`

## 6. 環境変数 / Environment Variables

```bash
AUTH0_DOMAIN="suguvisa-dev.auth0.com"
AUTH0_AUDIENCE="https://suguvisa-mcp-731026511067.asia-northeast1.run.app"
AUTH0_ISSUER_BASE_URL="https://suguvisa-dev.auth0.com"
AUTH0_MGMT_CLIENT_ID="<Management API Client ID>"
AUTH0_MGMT_CLIENT_SECRET="<Management API Client Secret>"
ALLOW_LEGACY_API_KEY="true"
```

## 7. 動作確認 / Verification / Verifikasi

### PRM エンドポイント

```bash
curl https://suguvisa-mcp-...run.app/.well-known/oauth-protected-resource
```

### トークン取得 & MCP 呼び出し

```bash
# Auth0 から M2M トークンを取得
TOKEN=$(curl -s --request POST \
  --url 'https://suguvisa-dev.auth0.com/oauth/token' \
  --header 'content-type: application/json' \
  --data '{"client_id":"<CLIENT_ID>","client_secret":"<CLIENT_SECRET>","audience":"https://suguvisa-mcp-...run.app","grant_type":"client_credentials","scope":"read:visa_case"}' \
  | jq -r '.access_token')

# MCP 呼び出し
curl -X POST https://suguvisa-mcp-...run.app/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### 不正トークンで 401 確認

```bash
curl -X POST https://suguvisa-mcp-...run.app/mcp \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# → 401 + WWW-Authenticate header
```
