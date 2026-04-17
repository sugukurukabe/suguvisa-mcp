/**
 * Pii<T> ラッパー
 * Pii<T> wrapper type — the core of the PII handling system.
 * Tipe pembungkus Pii<T> — inti sistem penanganan PII.
 *
 * ラップした値は既定では平文取得不可。`toString()` / `toJSON()` は常に
 * マスクされた表現を返し、`unmask(ctx)` でのみ平文を取得できる。
 * Wrapped values are not plaintext-accessible by default. `toString()` and
 * `toJSON()` always return the masked representation. Plaintext is only
 * retrievable via `unmask(ctx)`, which emits an audit event.
 */
import { maskByKind } from "./mask.js";
import type {
  AuditContext,
  PiiAuditEvent,
  PiiAuditLogger,
  PiiKind,
} from "./types.js";

/**
 * PII 値を保持するオブジェクト。直接の値アクセスは不可。
 * Holds a PII value with no direct access to plaintext.
 * Menyimpan nilai PII tanpa akses langsung ke plaintext.
 */
export class Pii<TKind extends PiiKind = PiiKind> {
  // ECMAScript の真のプライベートフィールド。Object.keys / Reflect でも見えない。
  // True ECMAScript private field — invisible to Object.keys / Reflect.
  // Bidang privat ECMAScript sejati — tak terlihat oleh Object.keys / Reflect.
  readonly #rawValue: string;
  readonly #auditLogger: PiiAuditLogger | undefined;
  readonly kind: TKind;

  constructor(value: string, kind: TKind, auditLogger?: PiiAuditLogger) {
    this.#rawValue = value;
    this.kind = kind;
    this.#auditLogger = auditLogger;
  }

  /**
   * マスク済み表現を返す。監査ログは発行しない。
   * Return the masked display. No audit event is emitted.
   * Mengembalikan tampilan mask. Tidak ada event audit.
   */
  mask(): string {
    return maskByKind(this.kind, this.#rawValue);
  }

  /**
   * 値が空 (empty string) か
   * Returns true when the wrapped value is an empty string.
   */
  isEmpty(): boolean {
    return this.#rawValue.length === 0;
  }

  /**
   * 監査コンテキストを付けて平文を取得する。
   * Retrieve plaintext with an audit context. Emits an audit event.
   * Mengambil plaintext dengan konteks audit. Memancarkan event audit.
   */
  unmask(context: AuditContext): string {
    const event: PiiAuditEvent = {
      actor: context.actor,
      tenantId: context.tenantId,
      reason: context.reason,
      resourceId: context.resourceId,
      requestId: context.requestId,
      piiKind: this.kind,
      timestamp: context.timestamp ?? new Date(),
    };
    if (this.#auditLogger) {
      void Promise.resolve(this.#auditLogger.logUnmask(event)).catch(() => {
        /* fail silently — caller must not be blocked by logger failures */
      });
    }
    return this.#rawValue;
  }

  /**
   * 値を新しいロガーに差し替えたコピーを作成
   * Clone the Pii with a different audit logger attached.
   * Klon Pii dengan logger audit berbeda.
   */
  withAuditLogger(logger: PiiAuditLogger): Pii<TKind> {
    return new Pii<TKind>(this.#rawValue, this.kind, logger);
  }

  /**
   * デフォルトの文字列化はマスク値
   * Default string serialization is masked.
   */
  toString(): string {
    return this.mask();
  }

  /**
   * JSON シリアライズはマスク値のみを返す
   * JSON serialization returns only the masked value.
   */
  toJSON(): { kind: PiiKind; masked: string } {
    return {
      kind: this.kind,
      masked: this.mask(),
    };
  }

  /**
   * util.inspect 等でも平文が漏れないようにする
   * Prevent plaintext leakage via util.inspect.
   */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `Pii<${this.kind}>(${this.mask()})`;
  }
}

/**
 * 便利ファクトリ
 * Convenience factories for each PII kind.
 * Factory praktis untuk setiap jenis PII.
 */
export const pii = {
  name: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "name", logger),
  nameKana: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "name_kana", logger),
  residenceCard: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "residence_card", logger),
  passport: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "passport", logger),
  dob: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "dob", logger),
  address: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "address", logger),
  phone: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "phone", logger),
  email: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "email", logger),
  corporateId: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "corporate_id", logger),
  myNumber: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "my_number", logger),
  bankAccount: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "bank_account", logger),
  generic: (value: string, logger?: PiiAuditLogger) =>
    new Pii(value, "generic", logger),
} as const;

/**
 * 値が Pii でラップされているかの型ガード
 * Type guard to check whether a value is wrapped by Pii.
 * Type guard untuk memeriksa apakah nilai dibungkus Pii.
 */
export function isPii(value: unknown): value is Pii {
  return value instanceof Pii;
}
