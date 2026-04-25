# @suguvisa/mcp-server

## 日本語

`@suguvisa/mcp-server` は、SuguVisa の公式 Remote MCP Server を見つけるための npm パッケージです。

このパッケージは locator / metadata package です。MCP サーバー本体、ビザルール、Golden Records、入管様式テンプレート、OCR/LLM 連携、課金・テナント実装、認証情報は含みません。

### 公式エンドポイント

- MCP endpoint: `https://mcp.suguvisa.com/mcp`
- Server card: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`
- OpenAI app manifest: `https://mcp.suguvisa.com/.well-known/openai-app.json`
- Smithery listing: `https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp`
- Support: `info@sugu-kuru.co.jp`

### CLI

```bash
npx @suguvisa/mcp-server info
npx @suguvisa/mcp-server endpoint
npx @suguvisa/mcp-server json
```

### JavaScript

```js
import { getSuguVisaMcpEndpoint, getSuguVisaMcpServerInfo } from "@suguvisa/mcp-server";

console.log(getSuguVisaMcpEndpoint());
console.log(getSuguVisaMcpServerInfo());
```

## English

`@suguvisa/mcp-server` is the official npm locator package for the hosted SuguVisa Remote MCP Server.

This package is a locator / metadata package only. It does not include the MCP server implementation, visa rules, Golden Records, immigration form templates, OCR/LLM integrations, billing or tenant logic, or credentials.

### Official Endpoints

- MCP endpoint: `https://mcp.suguvisa.com/mcp`
- Server card: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`
- OpenAI app manifest: `https://mcp.suguvisa.com/.well-known/openai-app.json`
- Smithery listing: `https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp`
- Support: `info@sugu-kuru.co.jp`

### CLI

```bash
npx @suguvisa/mcp-server info
npx @suguvisa/mcp-server endpoint
npx @suguvisa/mcp-server json
```

### JavaScript

```js
import { getSuguVisaMcpEndpoint, getSuguVisaMcpServerInfo } from "@suguvisa/mcp-server";

console.log(getSuguVisaMcpEndpoint());
console.log(getSuguVisaMcpServerInfo());
```

## Bahasa Indonesia

`@suguvisa/mcp-server` adalah paket npm locator resmi untuk SuguVisa Remote MCP Server yang di-hosting.

Paket ini hanya berisi locator / metadata. Paket ini tidak menyertakan implementasi server MCP, aturan visa, Golden Records, template formulir imigrasi, integrasi OCR/LLM, logika billing atau tenant, maupun kredensial.

### Endpoint Resmi

- MCP endpoint: `https://mcp.suguvisa.com/mcp`
- Server card: `https://mcp.suguvisa.com/.well-known/mcp/server-card.json`
- OpenAI app manifest: `https://mcp.suguvisa.com/.well-known/openai-app.json`
- Smithery listing: `https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp`
- Support: `info@sugu-kuru.co.jp`

### CLI

```bash
npx @suguvisa/mcp-server info
npx @suguvisa/mcp-server endpoint
npx @suguvisa/mcp-server json
```

### JavaScript

```js
import { getSuguVisaMcpEndpoint, getSuguVisaMcpServerInfo } from "@suguvisa/mcp-server";

console.log(getSuguVisaMcpEndpoint());
console.log(getSuguVisaMcpServerInfo());
```
