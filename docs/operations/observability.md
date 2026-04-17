# Observability 設計書 / Observability Design / Desain Observability

## 目的 / Goals / Tujuan

- すべての HTTP リクエスト・MCP ツール呼び出し・LLM 呼び出しを **request_id** で横串に追跡できるようにする
- 本番障害時に「誰 (tenant / principal) が」「どのツールを」「どのくらいの時間で」「どのような入出力で」呼んだかを特定できる
- LLM の token 使用量・レイテンシを長期的に可視化し、プラン設計とモデル選定にフィードバックする
- Cloud Run → Cloud Logging / Cloud Trace / Langfuse に送り、セキュリティ監査と SRE を両立する

Track every HTTP request, MCP tool invocation, and LLM call end-to-end by a single `request_id`; identify *who* called *which tool*, with *what latency*, and *what arguments* during incidents; track LLM token usage and latency long-term; ship to Cloud Logging / Cloud Trace / Langfuse.

Melacak setiap request HTTP, pemanggilan tool MCP, dan pemanggilan LLM end-to-end melalui satu `request_id`; mengidentifikasi *siapa* memanggil *tool apa*, dengan *latensi berapa*, dan *argumen apa* saat insiden; melacak penggunaan token LLM dan latensi jangka panjang; kirim ke Cloud Logging / Cloud Trace / Langfuse.

## 構成 / Architecture / Arsitektur

```
Client ──HTTP──▶ Cloud Run (Express)
                   │
                   ├─ obsMiddleware          ← request_id / traceparent → AsyncLocalStorage
                   ├─ OAuth middleware        ← principal / tenant
                   ├─ /mcp handler            ← updateObsContext({ tool, tenant, principal })
                   │    │
                   │    ├─ instrumentTool()    → OTEL span + Metrics counter/histogram
                   │    │                      → Langfuse trace.span
                   │    └─ recordLlmCall()     → Metrics + Langfuse trace.generation
                   │
                   ├─ pino logger (obsMixin)   → Cloud Logging (JSON) + stdout
                   ├─ OTEL SDK                 → Cloud Trace / OTLP
                   └─ Langfuse client          → cloud.langfuse.com (optional)
```

## コンテキスト伝播 / Context Propagation

`AsyncLocalStorage<ObsContext>` で 1 リクエストの情報をホストする。Express middleware が:
1. `X-Request-Id` ヘッダを尊重し、無ければ UUIDv4 を採番
2. `traceparent` を解析して `traceId / spanId` を格納
3. `http.method / http.route / user_agent` を attrs に入れる

OAuth 認証後は `updateObsContext({ tenantId, principalSubject })` で追記する。
その後のすべての処理（ツール呼び出し、LLM 呼び出し、ログ出力）から `getObsContext()` で同じ context を参照できる。

`AsyncLocalStorage` ベースなので callback 境界 / Promise チェーンを跨いでも文脈がロストしない。

## 計測対象 / What We Measure

### HTTP 層

| Metric | Type | Labels |
| --- | --- | --- |
| `http.server.requests` | counter | method, route, status |
| `http.server.duration_ms` | histogram | method, route, status |

### MCP ツール層

| Metric | Type | Labels |
| --- | --- | --- |
| `mcp.tool.calls` | counter | tool, status |
| `mcp.tool.duration_ms` | histogram | tool, status |

span: `mcp.tool.${toolName}`
attributes: `mcp.tool`, `mcp.request_id`, `mcp.tenant_id`, `mcp.principal`

### LLM 層

| Metric | Type | Labels |
| --- | --- | --- |
| `llm.calls` | counter | provider, model, status |
| `llm.latency_ms` | histogram | provider, model |
| `llm.total_tokens` | histogram | provider, model |

Langfuse trace: `trace.id = request_id`, `name = operation`, `userId = principal.sub`, `sessionId = tenant_id`
LLM は `trace.generation` で input / output / usage を記録。ツール呼び出しは `trace.span`。

## セキュリティ / Security / Keamanan

PII 流出を避けるために:
1. **入力サニタイゼーション**: `instrumentTool` の `sanitizeArgs` は 512 文字超の文字列と object / array を `<string len=N>` / `<object>` / `<array len=N>` にプレースホルダ化する。生の在留カード番号や氏名を Langfuse / Cloud Trace に送らない。
2. **ログ redaction**: `@suguvisa/core/logger` の `DEFAULT_PII_REDACT_PATHS` で在留カード・氏名・email・電話・住所等を `[REDACTED]` に置換。
3. **Request body のロギング禁止**: `obsMiddleware` は body を送信しない (method / route / status のみ)。
4. **traceparent**: 既存の W3C ヘッダを尊重し、クロスプロジェクトでもトレースを繋げる。
5. **テナント分離**: metrics ラベルに tenant を含めず (高カーディナリティと情報漏れ回避)、Langfuse の `sessionId` のみに載せる。

## Cloud Logging / Cloud Trace 連携

`initOtel({ exporter: "google" })` で:
- `@google-cloud/opentelemetry-cloud-trace-exporter` が span を **Cloud Trace** に送信
- pino の JSON 出力が Cloud Run stdout に流れ、そのまま **Cloud Logging** に構造化ログとして格納
- `obsMixin` が `requestId / traceId / tenantId / principal / operation` を自動付与
- Cloud Logging 側で `trace` / `spanId` フィールドとして展開するには `logging-format=cloud-logging` を検討（Phase 2 後半で導入）

`initOtel({ exporter: "otlp", otlpEndpoint: "http://localhost:4318" })` でローカル OTLP Collector に向けることも可能。

### 環境変数

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `OTEL_EXPORTER` | `none` | `none` / `google` / `otlp` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | なし | OTLP エクスポート先 |
| `GCP_PROJECT_ID` | なし | Cloud Trace プロジェクト |
| `LANGFUSE_PUBLIC_KEY` | なし | Langfuse pk |
| `LANGFUSE_SECRET_KEY` | なし | Langfuse sk |
| `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` | Langfuse エンドポイント |
| `LOG_LEVEL` | `info` | pino level |

## 開発環境 / Dev Mode

- `OTEL_EXPORTER=none` かつ Langfuse 未設定時は `NoopTracer` / `NoopMetrics` / `InMemoryLlmTracer` が使われ、完全にローカルで動作
- Vitest では `InMemoryMetrics` / `InMemoryLlmTracer` を `setMetrics` / `setLlmTracer` で差し替えて検証

## 今後の拡張 / Future Work

- **Metrics exporter**: Cloud Monitoring / Prometheus 向け exporter を `initOtel` に追加
- **Cloud Logging 構造化**: `logging.googleapis.com/trace` フィールドにリンクし、Cloud Console で log ↔ trace を往復可能にする
- **SLO ダッシュボード**: p50 / p95 latency・error rate・LLM コストを Looker Studio で可視化
- **アラート**: Slack 通知 (`#30-dev`) と PagerDuty を、error rate / p95 latency 閾値で起動
- **テナント別課金**: Langfuse の `sessionId = tenant_id` を用いて月次 token 使用量を集計し、プラン超過を検知
