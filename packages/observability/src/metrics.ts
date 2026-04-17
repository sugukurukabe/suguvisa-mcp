import { metrics } from "@opentelemetry/api";
import type { Metrics } from "./types.js";

/**
 * No-op メトリクス (テスト用)
 * No-op metrics implementation (testing)
 * Implementasi metrik no-op (pengujian)
 */
export class NoopMetrics implements Metrics {
  counter(): void {}
  histogram(): void {}
}

/**
 * In-memory メトリクス (Vitest 用)
 */
export class InMemoryMetrics implements Metrics {
  counters: Array<{ name: string; value: number; attrs?: Record<string, string | number> }> = [];
  histograms: Array<{ name: string; value: number; attrs?: Record<string, string | number> }> = [];
  counter(name: string, value: number, attrs?: Record<string, string | number>): void {
    this.counters.push({ name, value, attrs });
  }
  histogram(name: string, value: number, attrs?: Record<string, string | number>): void {
    this.histograms.push({ name, value, attrs });
  }
  clear(): void {
    this.counters = [];
    this.histograms = [];
  }
}

/**
 * OpenTelemetry メトリクス
 * OpenTelemetry-backed metrics
 * Metrik berbasis OpenTelemetry
 */
export class OtelMetrics implements Metrics {
  readonly #meterName: string;
  constructor(meterName = "@suguvisa/mcp-server") {
    this.#meterName = meterName;
  }
  counter(name: string, value: number, attrs?: Record<string, string | number>): void {
    const meter = metrics.getMeter(this.#meterName);
    meter.createCounter(name).add(value, attrs);
  }
  histogram(name: string, value: number, attrs?: Record<string, string | number>): void {
    const meter = metrics.getMeter(this.#meterName);
    meter.createHistogram(name).record(value, attrs);
  }
}

let defaultMetrics: Metrics = new NoopMetrics();

export function getMetrics(): Metrics {
  return defaultMetrics;
}

export function setMetrics(m: Metrics): void {
  defaultMetrics = m;
}
