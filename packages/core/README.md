# @suguvisa/core

## 概要 / Overview / Ikhtisar

モデル非依存のビジネスロジック層。PII 取扱い、構造化ログ、ドメイン共通型を提供する。

Model-agnostic business logic layer. Provides PII handling, structured logging
and shared domain types.

Lapisan logika bisnis yang tidak bergantung pada model. Menyediakan penanganan
PII, log terstruktur, dan tipe domain bersama.

## モジュール / Modules / Modul

### `@suguvisa/core/pii`

- `Pii<T>` 型: 平文アクセスに監査コンテキストを必須化するラッパー (`#private` field)
- `pii.*()` ファクトリ: 氏名・在留カード・パスポート等のショートカット生成
- `maskByKind` / `maskName` / `maskResidenceCard` 等のマスキング関数
- `InMemoryAuditLogger` / `CallbackAuditLogger` / `CompositeAuditLogger`
- `LocalKmsStub` (開発用) / `CloudKmsCipher` (Phase 4 で実装予定)

### `@suguvisa/core/logger`

- `createLogger({ tenantId })` — PII redact を事前設定した pino インスタンス
- `DEFAULT_PII_REDACT_PATHS` — 既定の redact パス一覧
- `maskedString()` — Pii/string どちらでも安全にマスク化するヘルパー

## 使用例 / Usage / Penggunaan

```typescript
import { pii, createLogger, InMemoryAuditLogger } from "@suguvisa/core";

const log = createLogger({ tenantId: "tenant_sugukuru" });
const audit = new InMemoryAuditLogger();

const card = pii.residenceCard("AB12345678CD", audit);

log.info({ card }, "loaded");
// {"card":{"kind":"residence_card","masked":"AB**********"}, ...}

const plaintext = card.unmask({
  actor: "user_kabe",
  tenantId: "tenant_sugukuru",
  reason: "申請書類生成",
});
// audit 1 event recorded
```

## 設計書 / Design docs / Dokumen desain

詳細は `docs/security/pii-handling.md` を参照。

## ロードマップ / Roadmap / Peta Jalan

- Phase 4: `CloudKmsCipher` を `@google-cloud/kms` で実装
- Phase 4: Supabase `pii_audit_events` テーブルへの監査ログ永続化
- Phase 2 以降で `apps/mcp-server/src/services/` の PII 取扱い箇所を `Pii<T>` に置換
