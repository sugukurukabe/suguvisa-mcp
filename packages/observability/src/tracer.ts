import { trace, type SpanStatusCode } from "@opentelemetry/api";
import type { Span, Tracer } from "./types.js";

/**
 * No-op Tracer
 * No-op Tracer (テスト/開発用)
 * Tracer no-op (untuk pengujian / pengembangan)
 */
export class NoopTracer implements Tracer {
  async startSpan<T>(_name: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
    return Promise.resolve(fn(noopSpan));
  }
}

const noopSpan: Span = {
  setAttribute() {},
  setAttributes() {},
  addEvent() {},
  recordException() {},
  setStatus() {},
};

/**
 * OpenTelemetry ベースの Tracer
 * OpenTelemetry-backed Tracer
 * Tracer berbasis OpenTelemetry
 */
export class OtelTracer implements Tracer {
  readonly #tracerName: string;
  constructor(tracerName = "@suguvisa/mcp-server") {
    this.#tracerName = tracerName;
  }

  async startSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: { attributes?: Record<string, string | number | boolean | undefined> },
  ): Promise<T> {
    const tracer = trace.getTracer(this.#tracerName);
    return tracer.startActiveSpan(name, async (otelSpan) => {
      if (options?.attributes) {
        const sanitized: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(options.attributes)) {
          if (v !== undefined) sanitized[k] = v;
        }
        otelSpan.setAttributes(sanitized);
      }
      const wrapper: Span = {
        setAttribute: (k, v) => {
          if (v !== undefined) otelSpan.setAttribute(k, v);
        },
        setAttributes: (attrs) => {
          const sanitized: Record<string, string | number | boolean> = {};
          for (const [k, v] of Object.entries(attrs)) {
            if (v !== undefined) sanitized[k] = v;
          }
          otelSpan.setAttributes(sanitized);
        },
        addEvent: (name, attrs) => {
          const sanitized: Record<string, string | number | boolean> = {};
          if (attrs) {
            for (const [k, v] of Object.entries(attrs)) {
              if (v !== undefined) sanitized[k] = v;
            }
          }
          otelSpan.addEvent(name, sanitized);
        },
        recordException: (err) => otelSpan.recordException(err as Error),
        setStatus: (status, message) => {
          // 0=UNSET, 1=OK, 2=ERROR (avoid importing enum value)
          const code: SpanStatusCode = status === "ok" ? 1 : (2 as SpanStatusCode);
          otelSpan.setStatus({ code, message });
        },
      };
      try {
        const result = await fn(wrapper);
        otelSpan.end();
        return result;
      } catch (err) {
        otelSpan.recordException(err as Error);
        otelSpan.setStatus({ code: 2 as SpanStatusCode, message: (err as Error)?.message });
        otelSpan.end();
        throw err;
      }
    });
  }
}

let defaultTracer: Tracer = new NoopTracer();

/**
 * Default tracer (テスト外では OtelTracer に差し替え推奨)
 * Get the default tracer singleton
 * Dapatkan singleton tracer default
 */
export function getTracer(): Tracer {
  return defaultTracer;
}

export function setTracer(tracer: Tracer): void {
  defaultTracer = tracer;
}
