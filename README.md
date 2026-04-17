# SuguVisa MCP

> 日本の特定技能（SSW）ビザ申請業務を、AIチャットだけで完結させる業界唯一のMCPサーバー。
>
> The only AI MCP server that fully automates Japan's Specified Skilled Worker (SSW) visa applications.
>
> Satu-satunya server MCP AI yang sepenuhnya mengotomatisasi permohonan visa Pekerja Berketerampilan Spesifik (SSW) Jepang.

[![Smithery](https://smithery.ai/badge/@a-kabe-1qio/suguvisa-mcp)](https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp)

## モノレポ構成 / Monorepo Structure / Struktur Monorepo

```
suguvisa-mcp/
├── apps/
│   └── mcp-server/          # MCP サーバー本体 / Main MCP server / Server MCP utama
├── packages/
│   ├── auth/                # OAuth 2.1 Resource Server
│   ├── core/                # ビジネスロジック / Business logic / Logika bisnis
│   ├── llm-router/          # マルチモデル抽象化 / Multi-model routing
│   ├── golden-records/      # Eval 用 Golden Records DAO
│   ├── observability/       # OpenTelemetry + Langfuse
│   ├── schemas/             # 共通型定義 / Shared types / Tipe bersama
│   ├── tenants/             # マルチテナント管理 / Multi-tenant management
│   └── billing/             # Stripe Billing 統合
├── infra/                   # Terraform / デプロイ
├── docs/                    # 設計・セキュリティ・提出書類
└── evals/                   # Promptfoo Eval パイプライン
```

## クイックスタート / Quick Start / Mulai Cepat

```bash
# 依存関係のインストール / Install dependencies / Instal dependensi
pnpm install

# ビルド / Build / Build
pnpm run build

# 開発サーバー（stdio MCP）/ Dev server (stdio MCP) / Server dev (stdio MCP)
pnpm run dev

# 開発サーバー（HTTP）/ Dev server (HTTP) / Server dev (HTTP)
pnpm run dev:http

# テスト / Test / Tes
pnpm run test
```

## 対応プラットフォーム / Supported Platforms / Platform yang Didukung

| プラットフォーム | 接続方式 |
|:---:|:---:|
| **Claude Desktop / Cursor / Windsurf** | stdio MCP |
| **Claude.ai** | Remote MCP (Streamable HTTP) |
| **ChatGPT** | GPT Actions (OpenAPI) |
| **REST API** | Bearer Token 認証 |

## ライセンス / License / Lisensi

MIT — [スグクル株式会社](https://sugu-kuru.co.jp) (Sugukuru Inc.)
