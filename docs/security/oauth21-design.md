# OAuth 2.1 設計書 / OAuth 2.1 Design Document

## 概要 / Overview

SuguVisa MCP サーバーは OAuth 2.1 Resource Server として機能し、Auth0 を Authorization Server として使用する。
Claude Connectors Directory / ChatGPT Apps Store の要件を満たす。

SuguVisa MCP server acts as an OAuth 2.1 Resource Server, using Auth0 as the Authorization Server.
This satisfies requirements for Claude Connectors Directory / ChatGPT Apps Store listing.

## アーキテクチャ / Architecture

```
Client (Claude/ChatGPT)
  │
  ├── GET /.well-known/oauth-protected-resource  → PRM (RFC 9728)
  │     → { resource, authorization_servers, scopes_supported }
  │
  ├── Auth0: /authorize (PKCE S256, resource indicator)
  │     → authorization code
  │
  ├── Auth0: /oauth/token (code_verifier)
  │     → JWT access_token (aud=suguvisa, scope=...)
  │
  └── POST /mcp  Bearer <jwt>
        → JWT verification via JWKS (10min cache)
        → Scope check per tool
        → MCP response
```

## 準拠する RFC / Applicable RFCs

| RFC | 説明 | 実装状況 |
|-----|------|----------|
| RFC 9728 | OAuth 2.0 Protected Resource Metadata | `/.well-known/oauth-protected-resource` |
| RFC 8414 | Authorization Server Metadata | `/.well-known/oauth-authorization-server` (proxy) |
| RFC 7636 | PKCE | S256 必須（Auth0 側で強制） |
| RFC 8707 | Resource Indicators | `resource` parameter → `aud` claim |
| RFC 6750 | Bearer Token Usage | `Authorization: Bearer <jwt>` |

## スコープ設計 / Scope Design

| スコープ | 説明 | 対象ツール数 |
|---------|------|-------------|
| `read:visa_case` | 案件情報の参照 | 15 |
| `read:golden_records` | ゴールデンレコードの参照 | — |
| `read:law_updates` | 法改正情報の参照 | 2 |
| `generate:reason_letter` | 申請理由書の生成 | 1 |
| `generate:paper_form` | 紙申請書マッピング | 2 |
| `generate:bulk_xlsm` | 一括申請Excel | 1 |
| `generate:annual_report` | 定期届出CSV | 4 |
| `validate:application_data` | 申請データ検証 | 3 |
| `review:document` | AI書類レビュー | 2 |
| `write:submission_outcome` | 申請結果の記録 | 1 |
| `write:audit_log` | 監査ログの記録 | 2 |
| `admin:tenant` | テナント設定の変更 | 1 |
| `admin:golden_records` | ゴールデンレコードの更新 | — |

## レガシー互換 / Legacy Compatibility

`ALLOW_LEGACY_API_KEY=true` のとき、既存の `SUGUVISA_API_KEY` による Bearer 認証も並行して受け付ける。
Legacy API Key で認証された場合、`principal.iss` は `'legacy'` となり、スコープチェックはスキップされる。

## 401 レスポンス / 401 Response

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="https://suguvisa-mcp-...run.app",
  error="invalid_token",
  error_description="Token has expired",
  resource_metadata="https://suguvisa-mcp-...run.app/.well-known/oauth-protected-resource"
```

## セキュリティ考慮事項 / Security Considerations

- JWT 署名は RS256（JWKS で公開鍵を取得、10 分キャッシュ）
- トークンを downstream API（GCS, Document AI 等）に転送しない
- PII を含むフィールドはログに出力しない（Phase 1 Task 1.4 で `PII<T>` 型を導入予定）
