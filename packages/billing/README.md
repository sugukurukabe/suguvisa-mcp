# @suguvisa/billing

## 概要 / Overview / Ikhtisar

SuguVisa MCP の Stripe 課金ライブラリ。プランカタログ、Stripe Checkout / Customer Portal、
Webhook ハンドラー、テスト用 Fake Client を提供する。

SuguVisa MCP's Stripe billing library. Provides plan catalog, Stripe Checkout /
Customer Portal, webhook handler, and a Fake client for testing.

Pustaka penagihan Stripe untuk SuguVisa MCP. Menyediakan katalog paket, Stripe
Checkout / Customer Portal, penangan webhook, dan klien palsu untuk pengujian.

## 使い方 / Usage / Penggunaan

```typescript
import {
  StripeBillingClient,
  buildPriceMappingFromEnv,
  processStripeEvent,
} from "@suguvisa/billing";

const client = new StripeBillingClient({
  apiKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});
const mappings = buildPriceMappingFromEnv();

// Checkout session を作る
const session = await client.createCheckoutSession({
  tenantId: "tenant-uuid",
  priceId: "price_xxxxx",
  successUrl: "https://app.example/success",
  cancelUrl: "https://app.example/cancel",
});
```

## 設計書 / Design doc / Dokumen desain

詳細な設計・セットアップ手順は [`docs/billing/README.md`](../../docs/billing/README.md) を参照。
