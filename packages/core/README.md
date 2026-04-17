# @suguvisa/core

## 概要 / Overview / Ikhtisar

モデル非依存のビジネスロジック層。申請パターン判定、書類生成、バリデーション等のコアロジックを格納する。

Model-agnostic business logic layer. Contains core logic for application pattern determination, document generation, validation, etc.

Lapisan logika bisnis yang tidak bergantung pada model. Berisi logika inti untuk penentuan pola permohonan, pembuatan dokumen, validasi, dll.

## ロードマップ / Roadmap / Peta Jalan

- Phase 2 以降で `apps/mcp-server/src/services/` からロジックを段階的に移行
- PII 暗号化（`PII<T>` 型）、設定管理（`config.ts`）を含む
