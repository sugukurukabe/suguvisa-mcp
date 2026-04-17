import type { NextFunction, Request, RequestHandler, Response } from "express";
import { parseTraceparent, newRequestId, withObsContext } from "./context.js";
import { getTracer } from "./tracer.js";
import { getMetrics } from "./metrics.js";
import type { ObsContext } from "./types.js";

/**
 * Express 用の observability ミドルウェア
 * Observability middleware for Express
 * Middleware observability untuk Express
 *
 * 役割:
 * - リクエスト ID を採番 (X-Request-Id ヘッダ優先)
 * - W3C traceparent を解析して ObsContext に格納
 * - レスポンスヘッダに X-Request-Id をセット
 * - 完了時に http.request metric を記録
 * - AsyncLocalStorage にコンテキストをバインド
 */
export function obsMiddleware(options: { operationPrefix?: string } = {}): RequestHandler {
  const prefix = options.operationPrefix ?? "http";
  return (req: Request, res: Response, next: NextFunction): void => {
    const incomingId = req.header("X-Request-Id") ?? req.header("x-request-id");
    const requestId = incomingId ?? newRequestId();
    const traceparent = req.header("traceparent") ?? req.header("Traceparent");
    const parsed = parseTraceparent(traceparent ?? undefined);
    const ctx: ObsContext = {
      requestId,
      traceId: parsed?.traceId,
      spanId: parsed?.spanId,
      operation: `${prefix}.${req.method} ${req.path}`,
      attrs: {
        "http.method": req.method,
        "http.route": req.path,
        "user_agent": req.header("user-agent") ?? "",
      },
    };
    res.setHeader("X-Request-Id", requestId);
    const start = Date.now();
    const metrics = getMetrics();
    withObsContext(ctx, () => {
      // span を張る (OTEL 未初期化なら no-op)
      return getTracer().startSpan(
        ctx.operation!,
        async () => {
          return new Promise<void>((resolve) => {
            res.on("finish", () => {
              const duration = Date.now() - start;
              metrics.counter("http.server.requests", 1, {
                method: req.method,
                route: req.path,
                status: res.statusCode,
              });
              metrics.histogram("http.server.duration_ms", duration, {
                method: req.method,
                route: req.path,
                status: res.statusCode,
              });
              resolve();
            });
            res.on("close", resolve);
            next();
          });
        },
        {
          attributes: {
            "http.method": req.method,
            "http.route": req.path,
          },
        },
      );
    });
  };
}
