# npm / Smithery 運用方針

## 日本語

SuguVisa の npm は、サーバー実装を配布する場所ではなく、公式スコープ `@suguvisa` と公式パッケージ名を確保し、開発者と審査担当者に本物の接続先を示すために使います。

### 公開する npm パッケージ

- Package: `@suguvisa/mcp-server`
- Role: 公式 Remote MCP Server の locator / metadata package
- Endpoint: `https://mcp.suguvisa.com/mcp`
- Server card: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`
- Smithery listing: `https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp`

### npm に含めないもの

- MCP サーバー本体
- ビザルール、Golden Records、評価データ
- 入管様式テンプレート、PDF/Excel 生成ロジック
- OCR、LLM、Auth0、Stripe、Supabase、GCP の実装
- `.env`、API key、OAuth token、サービスアカウント

### 公開前チェック

```bash
pnpm --filter @suguvisa/mcp-server exec npm pack --dry-run
pnpm --filter @suguvisa/mcp-server exec node ./cli.js json
pnpm --filter @suguvisa/mcp-server exec node ./cli.js endpoint
```

初回公開は npm にログインし、`@suguvisa` organization の owner 権限と 2FA を確認してから実行します。

```bash
npm publish --access public
```

### 旧 package の deprecate 文言

旧 package が存在する場合だけ、以下のように deprecate します。存在しない場合は実行しません。

```bash
npm deprecate "suguvisa-mcp@*" "SuguVisa official package moved to @suguvisa/mcp-server. Use https://mcp.suguvisa.com/mcp for the hosted Remote MCP server."
```

## English

SuguVisa uses npm to reserve and operate the official `@suguvisa` scope, not to distribute the hosted server implementation. The public package points developers and reviewers to the official Remote MCP endpoint and metadata.

### Public npm Package

- Package: `@suguvisa/mcp-server`
- Role: official locator / metadata package for the hosted Remote MCP Server
- Endpoint: `https://mcp.suguvisa.com/mcp`
- Server card: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`
- Smithery listing: `https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp`

### Excluded from npm

- MCP server implementation
- Visa rules, Golden Records, evaluation data
- Immigration form templates and PDF/Excel generation logic
- OCR, LLM, Auth0, Stripe, Supabase, and GCP implementations
- `.env`, API keys, OAuth tokens, and service account credentials

### Pre-publish Checks

```bash
pnpm --filter @suguvisa/mcp-server exec npm pack --dry-run
pnpm --filter @suguvisa/mcp-server exec node ./cli.js json
pnpm --filter @suguvisa/mcp-server exec node ./cli.js endpoint
```

The first publish should happen only after confirming npm login, owner permissions for the `@suguvisa` organization, and 2FA.

```bash
npm publish --access public
```

### Deprecation Message

Run this only if an old package exists.

```bash
npm deprecate "suguvisa-mcp@*" "SuguVisa official package moved to @suguvisa/mcp-server. Use https://mcp.suguvisa.com/mcp for the hosted Remote MCP server."
```

## Bahasa Indonesia

SuguVisa menggunakan npm untuk mengamankan dan mengoperasikan scope resmi `@suguvisa`, bukan untuk mendistribusikan implementasi server yang di-hosting. Paket publik hanya menunjukkan endpoint Remote MCP dan metadata resmi kepada developer serta reviewer.

### Paket npm Publik

- Package: `@suguvisa/mcp-server`
- Role: paket locator / metadata resmi untuk Remote MCP Server yang di-hosting
- Endpoint: `https://mcp.suguvisa.com/mcp`
- Server card: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`
- Smithery listing: `https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp`

### Tidak Disertakan di npm

- Implementasi server MCP
- Aturan visa, Golden Records, data evaluasi
- Template formulir imigrasi dan logika pembuatan PDF/Excel
- Implementasi OCR, LLM, Auth0, Stripe, Supabase, dan GCP
- `.env`, API key, OAuth token, dan kredensial service account

### Pemeriksaan Sebelum Publish

```bash
pnpm --filter @suguvisa/mcp-server exec npm pack --dry-run
pnpm --filter @suguvisa/mcp-server exec node ./cli.js json
pnpm --filter @suguvisa/mcp-server exec node ./cli.js endpoint
```

Publish pertama dilakukan setelah login npm, izin owner untuk organization `@suguvisa`, dan 2FA dikonfirmasi.

```bash
npm publish --access public
```

### Pesan Deprecation

Jalankan hanya jika package lama benar-benar ada.

```bash
npm deprecate "suguvisa-mcp@*" "SuguVisa official package moved to @suguvisa/mcp-server. Use https://mcp.suguvisa.com/mcp for the hosted Remote MCP server."
```
