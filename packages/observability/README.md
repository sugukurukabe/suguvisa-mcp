# @suguvisa/observability

## 概要 / Overview / Ikhtisar

SuguVisa MCP サーバー向けの observability ライブラリ。OpenTelemetry (trace + metrics) と Langfuse (LLM 観測) の薄いラッパを提供し、`AsyncLocalStorage` でリクエストコンテキストをすべてのツール / LLM 呼び出しに伝播させる。

Observability library for the SuguVisa MCP server. Provides thin wrappers around OpenTelemetry (trace + metrics) and Langfuse (LLM observability), and propagates a request-scoped context across every tool / LLM call via `AsyncLocalStorage`.

Pustaka observability untuk server MCP SuguVisa. Menyediakan pembungkus tipis di atas OpenTelemetry (trace + metrics) dan Langfuse (observability LLM), serta mengalirkan konteks berbasis permintaan ke setiap pemanggilan tool / LLM lewat `AsyncLocalStorage`.

## 使い方 / Usage / Penggunaan

### 1. Express への組み込み

```ts
import express from "express";
import {
  obsMiddleware,
  initOtel,
  LangfuseTracer,
  setLlmTracer,
} from "@suguvisa/observability";

await initOtel({
  serviceName: "suguvisa-mcp",
  exporter: "google", // "otlp" | "none" も可
  gcpProjectId: process.env.GCP_PROJECT_ID,
});

if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
  setLlmTracer(
    new LangfuseTracer({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    }),
  );
}

const app = express();
app.set("trust proxy", 1);
app.use(obsMiddleware());
```

### 2. MCP ツール計装

```ts
import { instrumentTool } from "@suguvisa/observability";

const searchHandler = instrumentTool("search_golden_records", async (args) => {
  return await retriever.search(args);
});
```

`instrumentTool` は以下を自動で記録:
- `mcp.tool.${name}` の span (OpenTelemetry)
- `mcp.tool.calls` counter / `mcp.tool.duration_ms` histogram
- Langfuse への tool call イベント
- 入力は `sanitizeArgs` で長大な文字列 / オブジェクトをマスク

### 3. LLM 呼び出しの記録

```ts
import { recordLlmCall } from "@suguvisa/observability";

await recordLlmCall({
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  inputTokens: 850,
  outputTokens: 120,
  totalTokens: 970,
  latencyMs: 1420,
  status: "success",
});
```

### 4. Logger との連携

`@suguvisa/core/logger` は pino ベース。observability の `obsMixin` を渡すだけで、すべてのログ行に `requestId / traceId / tenantId / principal / operation` が自動付与される。

```ts
import { createLogger } from "@suguvisa/core/logger";
import { obsMixin } from "@suguvisa/observability";

const log = createLogger({
  pinoOptions: { mixin: obsMixin },
});
```

## API サーフェス / Public API

| エクスポート | 役割 |
| --- | --- |
| `obsMiddleware()` | Express ミドルウェア。request_id / W3C traceparent / 属性を `ObsContext` として紐付ける。 |
| `instrumentTool(name, handler)` | MCP ツール handler を trace + metric + Langfuse でラップ。 |
| `recordLlmCall(event)` | LLM 呼び出しを記録 (counter + histogram + Langfuse)。 |
| `withObsContext(ctx, fn)` | 手動でコンテキストを張るためのヘルパ。 |
| `updateObsContext(patch)` | 現在のコンテキストに追記（principal や tenant を後から注入）。 |
| `initOtel(options)` | OpenTelemetry SDK を初期化（Cloud Trace / OTLP / none）。 |
| `setTracer`, `setMetrics`, `setLlmTracer` | Tracer / Metrics / LlmTracer の DI ポイント。 |
| `InMemoryMetrics`, `InMemoryLlmTracer`, `NoopTracer` | テスト用実装。 |
| `obsMixin` | pino logger 用の mixin。 |

## テスト / Tests

Vitest で 15 件:
- `context.test.ts` — AsyncLocalStorage と traceparent パース
- `mcp.test.ts` — instrumentTool / recordLlmCall
- `logger-mixin.test.ts` — pino mixin

## 依存 / Dependencies

- 必須: `@opentelemetry/api`, `@suguvisa/core`
- Optional peer: `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, `@google-cloud/opentelemetry-cloud-trace-exporter`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/auto-instrumentations-node`, `express`, `langfuse`

optional peer は `initOtel` / `obsMiddleware` / `LangfuseTracer` を使う場面でのみ必要。インストールしなくても `NoopTracer` / `NoopMetrics` / `InMemoryLlmTracer` にフォールバックする。
