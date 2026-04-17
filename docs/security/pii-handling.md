# PII 取扱い設計書 / PII Handling Design / Desain Penanganan PII

**対象パッケージ / Target package / Paket target**: `@suguvisa/core`
**最終更新 / Last updated / Pembaruan terakhir**: 2026-04-17
**責任者 / Owner / Penanggung jawab**: @sugukurukabe
**関連計画 / Related plan / Rencana terkait**: `SUGUVISA_UPGRADE_PLAN.md` Phase 1 Task 1.4

---

## 1. 目的 / Purpose / Tujuan

SuguVisa MCP が扱うすべての個人識別情報 (PII: Personally Identifiable Information) を、
**型レベルで区別**し、**平文アクセスを監査可能**にし、**保存時は envelope encryption** で
保護するための基盤を提供する。本設計は Pマーク (JIS Q 15001) 取得と、
個人情報保護法 第17条〜第22条、入管法 第19条の15 (在留カード番号の取扱い) に準拠する。

Provides the foundation for treating every piece of personal data handled by the
SuguVisa MCP server as (a) type-distinguished, (b) audit-gated on plaintext access
and (c) protected at rest by envelope encryption. This design supports the
Japanese Privacy Mark (JIS Q 15001), Articles 17–22 of APPI, and Article 19-15 of
the Immigration Control Act (residence-card number handling).

Memberikan fondasi untuk memperlakukan setiap data pribadi yang ditangani server
SuguVisa MCP sebagai (a) dibedakan pada level tipe, (b) akses plaintext
dikontrol audit, dan (c) dilindungi saat disimpan dengan enkripsi envelope.

---

## 2. PII の分類 / PII Classification / Klasifikasi PII

| `PiiKind`        | 日本語 | English | Bahasa Indonesia | マスク例 |
|------------------|-------|---------|------------------|----------|
| `name`           | 氏名 | Full name | Nama lengkap | `田中太郎` → `田***` |
| `name_kana`      | ふりがな | Name in kana | Nama dalam kana | `たなかたろう` → `た****` |
| `residence_card` | 在留カード番号 | Residence card number | Nomor kartu residensi | `AB12345678CD` → `AB**********` |
| `passport`       | パスポート番号 | Passport number | Nomor paspor | `TK1234567` → `TK*******` |
| `dob`            | 生年月日 | Date of birth | Tanggal lahir | `1995-03-15` → `1995-**-**` |
| `address`        | 住所 | Address | Alamat | `鹿児島県指宿市十町1-1-1` → `鹿児島県指宿市****` |
| `phone`          | 電話番号 | Phone | Telepon | `090-1234-5678` → `090-****-5678` |
| `email`          | メール | Email | Email | `taro@example.com` → `t***@example.com` |
| `corporate_id`   | 法人番号 | Corporate number | Nomor perusahaan | `1234567890123` → `1234*********` |
| `my_number`      | マイナンバー | My Number | Nomor Saya | `123456789012` → `************` (全桁) |
| `bank_account`   | 銀行口座番号 | Bank account | Rekening bank | `1234567` → `***4567` |
| `generic`        | 汎用 | Generic | Umum | second half masked |

`my_number` は入管業務では通常取り扱わないが、委託業務の将来拡張を見据えて
最も厳格な全桁マスクで分類している。

---

## 3. `Pii<T>` 型の設計 / `Pii<T>` Type Design / Desain Tipe `Pii<T>`

```typescript
import { pii } from "@suguvisa/core";

const card = pii.residenceCard("AB12345678CD");

String(card);                    // "AB**********"
JSON.stringify({ card });        // {"card":{"kind":"residence_card","masked":"AB**********"}}
card.mask();                     // "AB**********"
card.unmask(auditContext);       // "AB12345678CD"  ← 監査ログ発行
```

### 3.1 不変条件 / Invariants / Invarian

| 条件 | 保証 |
|-----|-----|
| `toString()` / `toJSON()` / `util.inspect` で平文が漏れない | ✅ すべて `mask()` を返す |
| `Object.keys(pii)` で raw 値が取得できない | ✅ ECMAScript `#private` 使用 |
| `Reflect.ownKeys` / プロトタイプ経由でも漏れない | ✅ `#` フィールドは反射 API から完全に隠蔽 |
| 平文取得には `AuditContext` が必須 | ✅ `unmask(ctx)` 以外に経路なし |
| 平文取得時に監査イベントが発行される | ✅ `unmask()` が `PiiAuditLogger.logUnmask()` を呼ぶ |
| ロガーの失敗が業務処理を止めない | ✅ logger 例外は握り潰し、unmask は成功する |

### 3.2 `AuditContext` の必須フィールド / Required fields / Bidang wajib

```typescript
interface AuditContext {
  actor: string;        // user_id or service account
  tenantId: string;     // マルチテナント分離の根拠
  reason: string;       // 業務上の必要性（自由記述）
  resourceId?: string;  // 対象案件 ID
  requestId?: string;   // trace との紐付け
  timestamp?: Date;     // 既定は現在時刻
}
```

**reason** は将来的に enum 化する候補: `reason_letter_generation`,
`audit_report`, `data_export_request`, `law_enforcement_request` 等。

---

## 4. Envelope Encryption の設計 / Envelope Encryption Design / Desain Enkripsi Envelope

### 4.1 方式 / Method / Metode

```
1 レコード暗号化の流れ:
  a) DEK (Data Encryption Key, 32 bytes) を毎回ランダム生成
  b) DEK で plaintext を AES-256-GCM で暗号化
  c) Tenant ごとの KEK (Key Encryption Key) で DEK を暗号化
  d) { ciphertext, wrappedDek, iv, authTag, kekVersion, algorithm } を保存

1 レコード復号化の流れ:
  a) Tenant ID から KEK を取得（Cloud KMS）
  b) KEK で wrappedDek を復号して DEK を得る
  c) DEK で ciphertext を復号
```

### 4.2 テナント分離 / Tenant isolation / Isolasi tenant

- **KEK は tenant ごとに別物**（Cloud KMS の keyring `suguvisa-pii/tenant-{tenantId}`）
- テナント A で暗号化されたデータはテナント B の KEK では復号できない
- LocalKmsStub はテスト用で、`HMAC(masterSecret, tenantId)` 方式で疑似的に再現
- クロステナント復号テストは `encryption.test.ts` で強制

### 4.3 KEK ローテーション / KEK rotation / Rotasi KEK

- `kekVersion` フィールドに鍵世代を記録
- 旧バージョン鍵で暗号化されたデータは旧バージョンで復号可能なまま維持
- 新規書き込みは常に最新 `kekVersion` を使用
- 定期的に old-version データを読み直して再暗号化 (migration job、Phase 4 実装予定)

### 4.4 本番統合計画 / Production integration plan / Rencana integrasi produksi

現時点では `LocalKmsStub`（開発専用）と `CloudKmsCipher`（未実装スタブ）の 2 種類。
Phase 4 で以下を実施:

- [ ] `@google-cloud/kms` を `CloudKmsCipher` に統合
- [ ] `mcp-service-492010` プロジェクトの keyring `suguvisa-pii` 作成 (Terraform)
- [ ] テナント作成時に自動で KEK を生成する Cloud Function
- [ ] KMS の CMEK (Customer Managed Encryption Key) オプション (Enterprise プラン)

---

## 5. ログでの自動マスキング / Automatic masking in logs / Masking otomatis pada log

### 5.1 pino redact paths

`@suguvisa/core/logger` の `createLogger()` が返す pino インスタンスは、
以下のフィールドパスを自動で `[REDACTED]` に置換する。

```
*.fullName, *.full_name, *.firstName, *.lastName,
*.residenceCard, *.residence_card, *.residenceCardNumber,
*.passport, *.passportNumber, *.myNumber,
*.dob, *.dateOfBirth, *.birthDate,
*.address, *.phone, *.phoneNumber, *.email,
*.bankAccount, *.password, *.apiKey, *.accessToken,
*.refreshToken, *.clientSecret,
req.headers.authorization, req.headers.cookie,
headers.authorization, headers.cookie
```

### 5.2 二重防衛 / Defense-in-depth / Pertahanan berlapis

1. **第一層**: コード上では `Pii<T>` でラップ → `toJSON` が自動マスク
2. **第二層**: 生文字列が誤って渡された場合の保険として、フィールド名ベースの redact
3. **第三層**: Cloud Logging 側でもフィールド名による検閲ルール (Phase 2 設定予定)

---

## 6. 監査ログの構造 / Audit log schema / Skema log audit

```typescript
interface PiiAuditEvent {
  actor: string;       // 例: "user_abc" or "service_account_eval_runner"
  tenantId: string;    // 例: "tenant_sugukuru"
  reason: string;      // 例: "申請理由書生成のため"
  resourceId?: string; // 例: "visa_case_123"
  requestId?: string;  // OpenTelemetry trace ID 相当
  piiKind: PiiKind;    // どの種別を unmask したか
  timestamp: Date;     // いつ
}
```

### 6.1 保管ポリシー / Retention / Retensi

- **最低 5 年** (Pマーク監査で必要)
- 個人情報保護法の開示請求 (第28条) に備え、actor × timestamp × piiKind で検索可能に
- Phase 2 で Supabase の `pii_audit_events` テーブル + 月次パーティションに保存予定
- Cloud Logging 側にも冗長送信 (fan-out)

### 6.2 閲覧権限 / Access control / Kontrol akses

- 監査ログ自体も PII を含む (`actor` は個人)
- 閲覧には `admin:audit_read` スコープが必要
- 閲覧行為もメタ監査ログに記録 (Phase 4)

---

## 7. 使用例 / Usage / Penggunaan

### 7.1 申請案件データ / Visa case data

```typescript
import { pii, createLogger, InMemoryAuditLogger } from "@suguvisa/core";

const log = createLogger({ tenantId: "tenant_sugukuru" });
const audit = new InMemoryAuditLogger();

const staff = {
  id: "staff_001",
  name: pii.name("田中太郎", audit),
  residenceCard: pii.residenceCard("AB12345678CD", audit),
  passport: pii.passport("TK1234567", audit),
  email: pii.email("taro@example.com", audit),
};

log.info({ staff }, "staff loaded");
// 出力: {"staff":{"id":"staff_001","name":{"kind":"name","masked":"田***"},...}}

// 書類生成時のみ平文を取得
const plainName = staff.name.unmask({
  actor: "user_kabe",
  tenantId: "tenant_sugukuru",
  reason: "申請理由書生成",
  resourceId: "visa_case_123",
});
```

### 7.2 DB 保存 / Database persistence

```typescript
import { LocalKmsStub } from "@suguvisa/core";

const kms = new LocalKmsStub(process.env.PII_MASTER_SECRET!);
const encrypted = await kms.encrypt("tenant_sugukuru", staff.residenceCard.unmask(ctx));

await db.insert("staff_pii", {
  staff_id: "staff_001",
  field: "residence_card",
  ...encrypted, // ciphertext, wrappedDek, iv, authTag, kekVersion, algorithm
});
```

---

## 8. 禁止事項 / Prohibitions / Larangan

1. `Pii<T>` を受け取った関数内で平文ログに出さないこと。`.mask()` を明示的に使う。
2. `unmask()` の戻り値を別変数に保持して使い回さないこと。必要な処理だけで完結させる。
3. `AuditContext.reason` に個人を特定可能な情報を含めないこと。
4. テスト以外で `LocalKmsStub` を本番利用しないこと (`NODE_ENV=production` で fail する gate を Phase 4 で追加)。
5. PII を URL query や form の平文として下流 API に送らないこと。Body の暗号化フィールドに限定。

---

## 9. 残課題 / Open items / Item terbuka

- [ ] `@google-cloud/kms` 統合と Terraform 化
- [ ] Supabase `pii_audit_events` テーブルのマイグレーション
- [ ] `apps/mcp-server` の既存ツールで residence card / passport を扱う箇所を `Pii<T>` に置換
- [ ] `packages/schemas` に Zod の `PiiSchema` を追加（パーサレベルで型を保つ）
- [ ] `@opentelemetry/api` から `requestId` を自動注入するヘルパー
- [ ] PII を含む Supabase 行の RLS ポリシー雛形
- [ ] 開示請求/削除請求のエンドポイント（Phase 4 Task 4.3）

---

## 10. 参考資料 / References / Referensi

- 個人情報保護委員会: https://www.ppc.go.jp/
- JIS Q 15001:2017 個人情報保護マネジメントシステム
- 出入国管理及び難民認定法 第19条の15 (在留カード)
- Google Cloud KMS envelope encryption: https://cloud.google.com/kms/docs/envelope-encryption
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
