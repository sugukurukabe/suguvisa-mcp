import { OtelMetrics, setMetrics } from "./metrics.js";
import { OtelTracer, setTracer } from "./tracer.js";

/**
 * OpenTelemetry の初期化オプション
 * Initialization options for OpenTelemetry SDK
 * Opsi inisialisasi untuk OpenTelemetry SDK
 */
export interface OtelInitOptions {
  serviceName: string;
  serviceVersion?: string;
  /** "google" で Cloud Trace exporter, "otlp" で OTLP/HTTP */
  exporter?: "google" | "otlp" | "none";
  /** OTLP endpoint (e.g. http://localhost:4318) */
  otlpEndpoint?: string;
  /** GCP project id (exporter=google の場合) */
  gcpProjectId?: string;
  /** サンプリング率 (0.0 - 1.0) */
  samplingRatio?: number;
}

/**
 * OpenTelemetry SDK を初期化
 * Initialize the OpenTelemetry SDK
 * Inisialisasi OpenTelemetry SDK
 *
 * @opentelemetry/sdk-node と exporter は optional peer dependency。
 * 実行時に dynamic import で解決する。
 * 初期化に失敗した場合 (依存が入っていない等) は no-op で安全に継続する。
 */
export async function initOtel(options: OtelInitOptions): Promise<{ shutdown: () => Promise<void> }> {
  const exporter = options.exporter ?? "none";
  if (exporter === "none") {
    // OTEL を初期化しないが、API 呼び出し自体は no-op で動くようデフォルトを設定
    setTracer(new OtelTracer(options.serviceName));
    setMetrics(new OtelMetrics(options.serviceName));
    return { shutdown: async () => {} };
  }

  const dynImport = new Function("specifier", "return import(specifier);") as (
    s: string,
  ) => Promise<Record<string, unknown>>;

  try {
    const { NodeSDK } = (await dynImport("@opentelemetry/sdk-node")) as {
      NodeSDK: new (config: Record<string, unknown>) => {
        start: () => void;
        shutdown: () => Promise<void>;
      };
    };

    let traceExporter: unknown;
    if (exporter === "google") {
      const gcp = (await dynImport("@google-cloud/opentelemetry-cloud-trace-exporter")) as {
        TraceExporter: new (options?: { projectId?: string }) => unknown;
      };
      traceExporter = new gcp.TraceExporter({ projectId: options.gcpProjectId });
    } else {
      const otlpMod = (await dynImport("@opentelemetry/exporter-trace-otlp-http")) as {
        OTLPTraceExporter: new (options?: { url?: string }) => unknown;
      };
      traceExporter = new otlpMod.OTLPTraceExporter({
        url: options.otlpEndpoint ? `${options.otlpEndpoint}/v1/traces` : undefined,
      });
    }

    const sdk = new NodeSDK({
      serviceName: options.serviceName,
      traceExporter,
    });
    sdk.start();
    setTracer(new OtelTracer(options.serviceName));
    setMetrics(new OtelMetrics(options.serviceName));
    return { shutdown: () => sdk.shutdown() };
  } catch (err) {
    console.error("OpenTelemetry init failed, continuing without SDK:", err);
    return { shutdown: async () => {} };
  }
}
