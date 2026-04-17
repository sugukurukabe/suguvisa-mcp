/**
 * PII 監査ログの実装
 * PII audit logger implementations
 * Implementasi logger audit PII
 *
 * 既定のインメモリロガーと、コールバック駆動の汎用ロガーを提供する。
 * 本番では Supabase / Firestore / Cloud Logging などへ差し替える想定。
 */
import type { PiiAuditEvent, PiiAuditLogger } from "./types.js";

/**
 * インメモリ監査ロガー
 * In-memory audit logger for testing and local development.
 * Logger audit in-memory untuk pengujian dan pengembangan lokal.
 */
export class InMemoryAuditLogger implements PiiAuditLogger {
  private readonly events: PiiAuditEvent[] = [];

  logUnmask(event: PiiAuditEvent): void {
    this.events.push(event);
  }

  /** 取得したイベント一覧（テスト用） / Retrieve events for test assertions */
  getEvents(): readonly PiiAuditEvent[] {
    return [...this.events];
  }

  /** イベントをクリア / Clear all events (test helper) */
  clear(): void {
    this.events.length = 0;
  }
}

/**
 * コールバック駆動ロガー
 * Callback-backed logger for production routing (Supabase etc.).
 * Logger berbasis callback untuk routing produksi (Supabase, dsb.).
 */
export class CallbackAuditLogger implements PiiAuditLogger {
  constructor(
    private readonly handler: (event: PiiAuditEvent) => void | Promise<void>,
  ) {}

  async logUnmask(event: PiiAuditEvent): Promise<void> {
    await this.handler(event);
  }
}

/**
 * 複合ロガー: 複数のロガーに同時に配送
 * Composite logger that fans out to multiple loggers.
 * Logger komposit yang meneruskan ke beberapa logger.
 */
export class CompositeAuditLogger implements PiiAuditLogger {
  constructor(private readonly loggers: readonly PiiAuditLogger[]) {}

  async logUnmask(event: PiiAuditEvent): Promise<void> {
    await Promise.all(this.loggers.map((l) => l.logUnmask(event)));
  }
}
