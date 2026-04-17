/**
 * Observability 型定義
 * Observability type definitions
 * Definisi tipe Observability
 */

/**
 * リクエストに紐づくコンテキスト
 * Per-request observability context
 * Konteks observability per-permintaan
 */
export interface ObsContext {
  requestId: string;
  /** トレース ID (W3C trace-context) */
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  principalSubject?: string;
  /** ツール / 操作名 */
  operation?: string;
  /** 自由属性 */
  attrs?: Record<string, string | number | boolean | undefined>;
}

/**
 * LLM 呼び出しイベント
 * LLM call event
 * Event pemanggilan LLM
 */
export interface LlmCallEvent {
  model: string;
  /** "claude" | "openai" | "vertex" | etc */
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** ms */
  latencyMs: number;
  /** プロンプト (マスク済みを想定) */
  prompt?: string;
  /** 応答本文 (マスク済みを想定) */
  response?: string;
  /** 追加メタ */
  metadata?: Record<string, unknown>;
  /** 成否 */
  status: "success" | "error";
  errorMessage?: string;
}

/**
 * ツール呼び出しイベント
 * Tool call event
 * Event pemanggilan tool
 */
export interface ToolCallEvent {
  tool: string;
  /** ms */
  durationMs: number;
  status: "success" | "error";
  /** 入力のサイズ (bytes) や keys */
  input?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * 抽象トレーサ
 * Abstract tracer
 * Tracer abstrak
 *
 * OpenTelemetry の薄いラッパで、テストや開発環境では no-op に差し替えられる
 */
export interface Tracer {
  startSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: { attributes?: Record<string, string | number | boolean | undefined> },
  ): Promise<T>;
}

export interface Span {
  setAttribute(key: string, value: string | number | boolean | undefined): void;
  setAttributes(attrs: Record<string, string | number | boolean | undefined>): void;
  addEvent(name: string, attrs?: Record<string, string | number | boolean | undefined>): void;
  recordException(err: unknown): void;
  setStatus(status: "ok" | "error", message?: string): void;
}

/**
 * 抽象メトリクス
 * Abstract metrics recorder
 * Perekam metrik abstrak
 */
export interface Metrics {
  counter(name: string, value: number, attrs?: Record<string, string | number>): void;
  histogram(name: string, value: number, attrs?: Record<string, string | number>): void;
}

/**
 * LLM トレーサ (Langfuse などのアダプタ)
 * LLM tracer (Langfuse adapter interface)
 * Tracer LLM (antarmuka adapter Langfuse)
 */
export interface LlmTracer {
  traceLlmCall(ctx: ObsContext, event: LlmCallEvent): Promise<void>;
  traceToolCall(ctx: ObsContext, event: ToolCallEvent): Promise<void>;
  /** バックエンドに保留中のイベントを送る */
  flush(): Promise<void>;
}
