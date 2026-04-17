/**
 * PII (Personally Identifiable Information) 型定義
 * PII (Personally Identifiable Information) type definitions
 * Definisi tipe PII (Informasi Identifikasi Pribadi)
 *
 * 入管業務で扱う個人情報を型レベルで区別し、平文取得には
 * 監査コンテキスト (audit context) を必須とする。
 * Immigration workflows classify personal data at the type level and
 * require an audit context for any plaintext access.
 * Alur kerja imigrasi mengklasifikasikan data pribadi pada tingkat tipe
 * dan memerlukan konteks audit untuk akses plaintext.
 */

/**
 * PII フィールド種別
 * PII field kinds
 * Jenis bidang PII
 *
 * 入管法・個人情報保護法の定義に沿って、在留カード/パスポートは
 * 特に厳格に扱う必要がある。
 */
export type PiiKind =
  | "name"            // 氏名 / Full name / Nama lengkap
  | "name_kana"       // ふりがな / Name in kana / Nama dalam kana
  | "residence_card"  // 在留カード番号 / Residence card number / Nomor kartu residensi
  | "passport"        // パスポート番号 / Passport number / Nomor paspor
  | "dob"             // 生年月日 / Date of birth / Tanggal lahir
  | "address"         // 住所 / Address / Alamat
  | "phone"           // 電話番号 / Phone number / Nomor telepon
  | "email"           // メールアドレス / Email address / Alamat email
  | "corporate_id"    // 法人番号 / Corporate number / Nomor perusahaan
  | "my_number"       // マイナンバー / My Number / Nomor Saya
  | "bank_account"    // 銀行口座番号 / Bank account / Rekening bank
  | "generic";        // 汎用 PII / Generic PII / PII umum

/**
 * 監査コンテキスト — PII の平文取得時に必須で渡す
 * Audit context — required when unmasking PII
 * Konteks audit — wajib saat membuka mask PII
 */
export interface AuditContext {
  /** 操作を実行するユーザー / Principal subject identifier */
  readonly actor: string;
  /** テナント ID / Tenant identifier */
  readonly tenantId: string;
  /** 監査理由（業務上の必要性） / Audit reason for business necessity */
  readonly reason: string;
  /** 対象リソース ID（任意） / Target resource identifier (optional) */
  readonly resourceId?: string;
  /** リクエスト ID（任意、trace に紐付け） / Request identifier for trace correlation */
  readonly requestId?: string;
  /** 発生時刻（デフォルト: 現在時刻） / Timestamp (defaults to now) */
  readonly timestamp?: Date;
}

/**
 * 監査ログエントリ
 * Audit log entry
 * Entri log audit
 */
export interface PiiAuditEvent {
  readonly actor: string;
  readonly tenantId: string;
  readonly reason: string;
  readonly resourceId?: string;
  readonly requestId?: string;
  readonly piiKind: PiiKind;
  readonly timestamp: Date;
}

/**
 * 監査ロガーのインターフェース
 * Audit logger interface
 * Antarmuka logger audit
 *
 * 実装は Supabase / Firestore / pino 等に自由にルーティング可能。
 * 開発時は InMemoryAuditLogger をデフォルトで使用。
 */
export interface PiiAuditLogger {
  logUnmask(event: PiiAuditEvent): void | Promise<void>;
}

/**
 * 暗号化インターフェース — Cloud KMS envelope encryption の抽象化
 * Encryption interface — abstraction over Cloud KMS envelope encryption
 * Antarmuka enkripsi — abstraksi enkripsi envelope Cloud KMS
 *
 * テナントごとに別 KEK を用いることで、クロステナント漏洩を防ぐ。
 */
export interface PiiCipher {
  encrypt(tenantId: string, plaintext: string): Promise<EncryptedPayload>;
  decrypt(tenantId: string, payload: EncryptedPayload): Promise<string>;
}

/**
 * 暗号化ペイロード
 * Encrypted payload
 * Payload terenkripsi
 *
 * envelope encryption の結果。DEK は KEK で暗号化された状態で含まれる。
 */
export interface EncryptedPayload {
  /** 暗号文 (base64) / Ciphertext (base64) */
  readonly ciphertext: string;
  /** 暗号化された DEK (base64) / Encrypted data encryption key (base64) */
  readonly wrappedDek: string;
  /** IV / nonce (base64) / Initialization vector / nonce (base64) */
  readonly iv: string;
  /** auth tag (base64) / Authentication tag (base64) */
  readonly authTag: string;
  /** KEK バージョン識別子 / KEK version identifier */
  readonly kekVersion: string;
  /** アルゴリズム識別子 / Algorithm identifier */
  readonly algorithm: "AES-256-GCM";
}
