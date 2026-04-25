/**
 * セキュリティヘッダミドルウェア
 * Security headers middleware
 * Middleware header keamanan
 *
 * OpenAI Apps SDK / ChatGPT Apps Store 提出要件:
 *   - Content-Security-Policy は必須 (Apps SDK docs: "You defined a content security
 *     policy (CSP) to allow the exact domains you fetch from")
 *
 * Claude Connectors Directory も同等のセキュリティ水準を要求する。
 *
 * 対象パス:
 *   - 全ルートに共通ヘッダ (HSTS / X-Content-Type-Options / Referrer-Policy / X-Frame-Options / Permissions-Policy)
 *   - HTML を返すルート (/, /privacy, /terms, /security, /support, /docs) に厳格な CSP
 *   - JSON / アセットルートはレンダリング対象ではないが、同じ CSP を返しても実害はないため統一する
 *
 * 注意: HTML は外部 CDN / 外部スクリプトをロードしない自己完結設計なので、
 *   script-src / style-src は 'self' + 'unsafe-inline' (インライン <style>/JSON-LD のため) のみ。
 *   外部リソースを追加する場合はここも更新すること。
 */
import type { Request, Response, NextFunction } from "express";

// すべてのレスポンスに共通で付与するセキュリティヘッダ
// Security headers applied to every response
// Header keamanan yang ditempatkan pada setiap respons
const COMMON_HEADERS: Record<string, string> = {
  // HSTS: Cloudflare が既に 2 年 + includeSubDomains + preload を付けているが、
  // オリジン (Cloud Run) 自体からも送ることで Cloudflare 経由でないアクセス時にも有効化される。
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
  // 旧 IE / 旧 Edge 用。CSP がある環境では effectively deprecated だが害はない。
  "X-XSS-Protection": "0",
};

// CSP: 自ドメイン配信のみ。外部 JS / CSS / font / image / iframe は一切許可しない。
// CSP: self-origin only. No external JS / CSS / font / image / iframe is allowed.
// CSP: hanya origin sendiri. Tidak ada sumber daya eksternal yang diizinkan.
//
// - 'unsafe-inline' を style-src と script-src に付ける理由:
//   * HTML テンプレートがインライン <style> と <script type="application/ld+json"> を使う
//   * どちらも自ドメイン配信の静的コンテンツに限定される (html.ts のみ)
//   * ユーザー入力由来のコンテンツを innerHTML 等で描画するルートは存在しない
// - object-src / frame-src を 'none' にすることで、iframe 埋め込みを伴うクリック
//   ジャッキング・Flash 等レガシー攻撃面を完全に遮断する。
const CSP_DIRECTIVES: Record<string, string> = {
  "default-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
  "object-src": "'none'",
  "img-src": "'self' data:",
  "font-src": "'self' data:",
  "style-src": "'self' 'unsafe-inline'",
  "script-src": "'self' 'unsafe-inline'",
  "connect-src": "'self' https://mcp.suguvisa.com https://suguvisa.com",
  "manifest-src": "'self'",
  "media-src": "'none'",
  "worker-src": "'none'",
  "upgrade-insecure-requests": "",
};

const CSP_VALUE: string = Object.entries(CSP_DIRECTIVES)
  .map(([k, v]) => (v === "" ? k : `${k} ${v}`))
  .join("; ");

export function securityHeaders() {
  return function securityHeadersMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    for (const [k, v] of Object.entries(COMMON_HEADERS)) {
      res.setHeader(k, v);
    }
    res.setHeader("Content-Security-Policy", CSP_VALUE);
    // Cross-Origin Opener / Embedder / Resource ポリシーは SSO ポップアップと衝突し
    // やすいので、OAuth フロー互換を優先して設定しない。将来的に独自フロントを
    // 分離配信した時点で段階的に厳格化する。
    next();
  };
}

// テスト・デバッグ用に CSP 値を外からも参照できるようエクスポート。
export { CSP_VALUE as CONTENT_SECURITY_POLICY };
