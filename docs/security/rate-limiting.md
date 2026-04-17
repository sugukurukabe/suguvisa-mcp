# レート制限・DDoS 対策設計書 / Rate Limiting & DDoS Design / Desain Pembatasan Laju & DDoS

**対象 / Target / Target**: SuguVisa MCP server + Cloud Run + Cloud Armor
**最終更新 / Last updated / Pembaruan terakhir**: 2026-04-17
**計画 / Plan / Rencana**: `SUGUVISA_UPGRADE_PLAN.md` Phase 1 Task 1.5

---

## 1. 目的 / Purpose / Tujuan

SuguVisa MCP への悪意ある大量リクエスト、ブルートフォース、誤動作するクライアントの
暴走からサービスを保護し、**SaaS 課金の公平性** を担保する。

Protect the SuguVisa MCP service from malicious floods, brute-force attempts,
and runaway clients while ensuring fair usage across SaaS tenants.

Melindungi layanan SuguVisa MCP dari banjir berbahaya, upaya brute-force, dan
klien yang salah konfigurasi, sambil memastikan penggunaan adil antar tenant SaaS.

---

## 2. 多層防御 / Defense-in-depth / Pertahanan berlapis

```
┌──────────────────────────────────────────────────────────────┐
│  Internet                                                     │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 0: Cloud Armor (infra/terraform/cloud-armor.tf)        │
│  - Anthropic / OpenAI / 社内 IP allowlist                      │
│  - /mcp: 100 req/min per IP (hard cap, ban 5 min)             │
│  - /.well-known: 30 req/min per IP (ban 10 min)               │
│  - Adaptive Protection (ML DDoS detection)                    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Global IP limiter (@suguvisa/core/rate-limit)       │
│  - 100 req/min per IP (preset: rateLimitPresets.global)       │
│  - Fires BEFORE auth, stops flooders early                    │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: Sensitive endpoint limiter                          │
│  - /.well-known: 10 req/min per IP                            │
│  - Slows down OAuth discovery scrapers                        │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 3: Plan-aware per-tenant limiter (legacy)              │
│  - /mcp: free 10, starter 30, pro 60, unlimited 300 req/min   │
│  - Key = tenant_id (Supabase)                                 │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 4: Tool-level quota (Phase 4: tenant toolCalls/hour)   │
│  - Stripe usage metering                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. `@suguvisa/core/rate-limit` の API / Public API

### 3.1 プリセット / Presets / Preset

```typescript
import { rateLimitPresets, createRateLimiter } from "@suguvisa/core/rate-limit";

rateLimitPresets.global;              // IP, 100/min
rateLimitPresets.sensitive;           // IP, 10/min  (/.well-known, etc.)
rateLimitPresets.mcp;                 // Principal, 60/min (authenticated)
rateLimitPresets.toolCallsPerTenant;  // Tenant, 1000/hour
```

### 3.2 使い方 / Usage / Penggunaan

```typescript
import express from "express";
import {
  createRateLimiter,
  createRedisStore,
  rateLimitPresets,
} from "@suguvisa/core/rate-limit";

const app = express();
app.set("trust proxy", 1);

// In-memory (dev)
app.use(createRateLimiter(rateLimitPresets.global));

// Redis (prod, multi-instance Cloud Run)
const store = await createRedisStore({ url: process.env.REDIS_URL! });
app.use(createRateLimiter({ ...rateLimitPresets.global, store }));
```

### 3.3 キー生成戦略 / Key-generator strategies / Strategi generator kunci

| 関数          | 形式                                   | 用途                                            |
|--------------|----------------------------------------|------------------------------------------------|
| `ipKey`      | `ip:1.2.3.4`                           | 未認証、全体レートリミット                       |
| `principalKey` | `tenant:x\|sub:user_abc`             | 認証済みユーザー単位（Auth0 sub）               |
| `tenantKey`  | `tenant:x` or fallback `ip:1.2.3.4`    | マルチテナント quota、複数ユーザーで共有         |

Cloud Run の前段に Cloud Armor / GCLB がいるため、`app.set("trust proxy", 1)`
を設定し、`X-Forwarded-For` の先頭を client IP として採用する。

---

## 4. 429 応答仕様 / 429 Response Spec / Spesifikasi Respons 429

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1744892400

{
  "error": "rate_limit_exceeded",
  "error_description": "Too many requests from this IP",
  "retry_after_seconds": 60
}
```

- `Retry-After`: RFC 9110 準拠、秒単位
- `RateLimit-*`: `draft-7` (IETF ratelimit-headers draft)
- エラーボディは OAuth 2.1 / RFC 6749 のエラー表現に近い形

---

## 5. プラン別 quota / Plan quotas / Kuota paket

```typescript
import { PLAN_QUOTAS } from "@suguvisa/core/rate-limit";

PLAN_QUOTAS.free;       // 50 tool calls/hour, 30 req/min
PLAN_QUOTAS.starter;    // 1000, 60
PLAN_QUOTAS.pro;        // 5000, 120
PLAN_QUOTAS.enterprise; // 100000, 600
```

- Phase 4 で `packages/billing` の Stripe 統合と連動
- プラン上限を超えた tool 呼び出しは **402 Payment Required** を返す (プラン別 gating)
- 超過時の猶予 burst: ±10% 程度の自動オーバーヘッド許容（sliding window の性質）

---

## 6. 運用ポリシー / Operations / Kebijakan operasional

### 6.1 監視 / Monitoring / Pemantauan

- Cloud Logging のログベースメトリクス: 1 分あたりの 429 件数
- アラート: 5 分間で 1000 件超 → `#suguvisa-alerts` に Slack 通知
- テナント別 429 集計は Phase 2 の Observability 基盤 (Langfuse) に連動

### 6.2 IP ban 運用 / IP ban / Ban IP

- Cloud Armor の `rate_based_ban` を使用 (5 分〜10 分)
- 繰り返し悪意あるトラフィックは Terraform の `deny` ルールで手動追加
- 誤検知の解除窓口: `security@suguvisa.jp` (Phase 4 で Pマーク対応時に公開)

### 6.3 Redis 障害時の挙動 / Redis failure fallback / Fallback saat Redis gagal

- `createRedisStore` が失敗した場合、サーバーは in-memory にフォールバックしてログを出す
- 単一 Cloud Run インスタンスでは in-memory で実質的に機能する
- 複数インスタンス時は Redis 必須 → Redis 復旧まで `REDIS_URL` を設定した運用で監視必須

---

## 7. 既知の制限 / Known limitations / Keterbatasan

1. **Cloud Run の multi-instance**: in-memory store では各インスタンスで独立カウンタ。本番では Redis 必須。
2. **Cloud Armor 未適用**: 現状 Terraform ドラフトのみ。手動 `apply` 前に最新の Anthropic/OpenAI IP レンジ同期が必要。
3. **Auth0 /oauth/token**: 現状は Auth0 が直接ホスト。ブルートフォース対策は Auth0 側の Anomaly Detection に委譲。
4. **プラン別 quota**: 既存の `apiRateLimiter` は `req.tenant` (legacy API key 由来) に依存。OAuth モードでは `principalKey` で代替する実装が必要（Phase 4 で統合）。

---

## 8. 残課題 / Open items / Item terbuka

- [ ] `infra/terraform/cloud-armor.tf` の本番 apply と Cloud Run LB 連携
- [ ] `scripts/update-allowlist.ts` で Anthropic / OpenAI IP レンジを日次更新
- [ ] `@suguvisa/core/rate-limit` と OAuth principal の統合 (OAuth モードでの /mcp リミット)
- [ ] Upstash Redis (serverless) vs GCP Memorystore の選定
- [ ] quota 超過時のテナント通知 (Email / Slack) 設計
- [ ] Observability: 429 を Langfuse の custom event として記録

---

## 9. 参考 / References / Referensi

- RFC 9110 §10.2.3 (Retry-After): https://www.rfc-editor.org/rfc/rfc9110
- IETF draft-ietf-httpapi-ratelimit-headers-08: https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
- Cloud Armor Adaptive Protection: https://cloud.google.com/armor/docs/adaptive-protection-overview
- express-rate-limit docs: https://express-rate-limit.mintlify.app/
- Auth0 Anomaly Detection: https://auth0.com/docs/secure/attack-protection
