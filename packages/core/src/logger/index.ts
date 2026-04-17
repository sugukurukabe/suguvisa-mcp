/**
 * pino ベースの構造化ロガー
 * pino-based structured logger with PII redaction defaults.
 * Logger terstruktur berbasis pino dengan redaksi PII default.
 *
 * 使い方 / Usage / Penggunaan:
 *   import { createLogger } from "@suguvisa/core/logger";
 *   const log = createLogger({ tenantId: "tenant_xxx" });
 *   log.info({ residenceCard: "AB12345678CD" }, "processing case");
 *   // → "residenceCard":"[REDACTED]"
 *
 * Pii<T> インスタンスは toJSON が自動で呼ばれるためマスクされる。
 * 生文字列をうっかり渡した場合の保険として、フィールド名ベースの
 * redact パスをデフォルトで設定する。
 */
import { pino, type Logger, type LoggerOptions } from "pino";

/**
 * PII として自動的に [REDACTED] に置換するフィールドパス
 * Field paths automatically replaced with [REDACTED].
 * Path bidang yang otomatis diganti dengan [REDACTED].
 */
export const DEFAULT_PII_REDACT_PATHS = [
  // 氏名系
  "*.fullName",
  "*.full_name",
  "*.firstName",
  "*.first_name",
  "*.lastName",
  "*.last_name",
  "*.familyName",
  "*.givenName",
  "*.nameKana",
  "*.name_kana",
  // 証書系 / identity documents
  "*.residenceCard",
  "*.residence_card",
  "*.residenceCardNumber",
  "*.residence_card_number",
  "*.passport",
  "*.passportNumber",
  "*.passport_number",
  "*.myNumber",
  "*.my_number",
  // 属性系
  "*.dob",
  "*.dateOfBirth",
  "*.date_of_birth",
  "*.birthDate",
  "*.birth_date",
  "*.address",
  "*.phone",
  "*.phoneNumber",
  "*.phone_number",
  "*.email",
  "*.emailAddress",
  "*.email_address",
  "*.bankAccount",
  "*.bank_account",
  "*.bankAccountNumber",
  "*.bank_account_number",
  // 認証系
  "*.password",
  "*.apiKey",
  "*.api_key",
  "*.accessToken",
  "*.access_token",
  "*.refreshToken",
  "*.refresh_token",
  "*.clientSecret",
  "*.client_secret",
  // トップレベルの認証ヘッダー
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
] as const;

/**
 * ロガー生成オプション
 * Logger factory options.
 * Opsi factory logger.
 */
export interface CreateLoggerOptions {
  /** テナント ID を全ログに注入 / Inject tenant ID into every log */
  readonly tenantId?: string;
  /** サービス名 / Service name */
  readonly service?: string;
  /** 環境 / Environment name */
  readonly environment?: "development" | "production" | "test";
  /** 追加の redact パス / Additional redact paths */
  readonly additionalRedactPaths?: readonly string[];
  /** 検閲後の表現 / Censor token */
  readonly censor?: string;
  /** pino オプションの直接上書き / Raw pino overrides */
  readonly pinoOptions?: LoggerOptions;
}

/**
 * createLogger — PII redaction 付き pino インスタンスを生成
 * Create a pino instance with PII redaction pre-configured.
 * Buat instance pino dengan konfigurasi redaksi PII.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const {
    tenantId,
    service = "suguvisa-mcp",
    environment = (process.env.NODE_ENV as CreateLoggerOptions["environment"]) ??
      "development",
    additionalRedactPaths = [],
    censor = "[REDACTED]",
    pinoOptions = {},
  } = options;

  const redactPaths = [
    ...DEFAULT_PII_REDACT_PATHS,
    ...additionalRedactPaths,
  ];

  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: {
      service,
      env: environment,
      ...(tenantId ? { tenantId } : {}),
    },
    redact: {
      paths: redactPaths,
      censor,
      remove: false,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...pinoOptions,
  });

  return logger;
}

/**
 * Pii インスタンスを明示的に文字列化するヘルパー
 * Helper to explicitly mask a Pii value for logging.
 * Helper untuk mask eksplisit nilai Pii saat logging.
 *
 * 通常は toJSON が呼ばれるため不要だが、テンプレート中で文字列として
 * 使いたい場面のために用意。
 */
export function maskedString(value: { mask(): string } | string | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return value.mask();
}
