/**
 * Directory router / ディレクトリ掲載用ルート / Router direktori
 *
 * Claude Connectors Directory と ChatGPT Apps Store への掲載に必要な
 * エンドポイントをまとめた Express Router。
 *
 * - Manifest: /.well-known/mcp/server-card.json, /.well-known/ai-plugin.json,
 *             /.well-known/openai-app.json
 * - Static assets: /logo.svg, /favicon.svg, /og-image.{svg,png}, /openapi.yaml
 * - Legal / support HTML: /, /privacy, /terms, /security, /support
 * - Plain text: /.well-known/security.txt, /robots.txt, /sitemap.xml
 */
import { Router, type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { buildDirectoryMetadata } from "./metadata.js";
import { serverCardHandler } from "./server-card.js";
import { aiPluginHandler } from "./ai-plugin.js";
import { openaiAppHandler } from "./openai-app.js";
import {
  landingHandler,
  privacyHandler,
  termsHandler,
  securityHandler,
  supportHandler,
} from "./pages.js";

export function createDirectoryRouter(): Router {
  const router = Router();

  // Manifests
  router.get("/.well-known/mcp/server-card.json", serverCardHandler);
  router.get("/.well-known/ai-plugin.json", aiPluginHandler);
  router.get("/.well-known/openai-app.json", openaiAppHandler);

  // OpenAPI
  router.get("/openapi.yaml", (_req: Request, res: Response) => {
    const specPath = path.resolve(process.cwd(), "public", "openapi.yaml");
    if (fs.existsSync(specPath)) {
      res.type("text/yaml").sendFile(specPath);
    } else {
      res.status(404).json({ error: "openapi.yaml not found" });
    }
  });

  // Static branding assets
  router.get("/logo.svg", staticFileHandler("public/logo.svg", "image/svg+xml"));
  router.get("/logo.png", staticFileHandler("public/logo.png", "image/png"));
  router.get("/icon-1024.png", staticFileHandler("public/icon-1024.png", "image/png"));
  router.get("/icon-512.png", staticFileHandler("public/icon-512.png", "image/png"));
  router.get("/icon-256.png", staticFileHandler("public/icon-256.png", "image/png"));
  router.get("/apple-touch-icon.png", staticFileHandler("public/apple-touch-icon.png", "image/png"));
  router.get("/favicon.svg", staticFileHandler("public/favicon.svg", "image/svg+xml"));
  router.get("/favicon.ico", staticFileHandler("public/favicon.svg", "image/svg+xml"));
  router.get("/favicon-32.png", staticFileHandler("public/favicon-32.png", "image/png"));
  router.get("/og-image.png", staticFileHandler("public/og-image.png", "image/png"));
  router.get("/og-image.svg", staticFileHandler("public/og-image.png", "image/png")); // legacy path, serves PNG

  // Screenshot / marketing assets (served from public/assets/ if present)
  router.get("/assets/:filename", (req: Request, res: Response) => {
    const raw = req.params.filename;
    const name = Array.isArray(raw) ? raw[0] : raw;
    if (typeof name !== "string" || !/^[\w.-]+$/.test(name)) {
      res.status(400).json({ error: "invalid filename" });
      return;
    }
    const abs = path.resolve(process.cwd(), "public/assets", name);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: "asset not found" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=86400").sendFile(abs);
  });

  // HTML pages
  router.get("/", landingHandler);
  router.get("/privacy", privacyHandler);
  router.get("/terms", termsHandler);
  router.get("/security", securityHandler);
  router.get("/support", supportHandler);
  router.get("/docs", (_req, res) => res.redirect(302, "/openapi.yaml"));

  // Google Search Console の HTML ファイル検証 /
  // Google Search Console HTML file verification /
  // Verifikasi file HTML Google Search Console
  //
  // 検証方法を選択した際に Google がダウンロードを要求する `google<token>.html` を
  // 動的に返す。トークンは `GOOGLE_VERIFICATION_HTML_TOKEN` 環境変数で設定する。
  // 例: GOOGLE_VERIFICATION_HTML_TOKEN="abc123" → GET /googleabc123.html
  router.get(/^\/google([a-z0-9]+)\.html$/i, (req: Request, res: Response) => {
    const token = (process.env.GOOGLE_VERIFICATION_HTML_TOKEN ?? "").trim();
    if (!token) {
      res.status(404).json({ error: "verification token not configured" });
      return;
    }
    const raw = req.params[0];
    const requested = Array.isArray(raw) ? raw[0] : raw;
    if (requested !== token) {
      res.status(404).json({ error: "verification token mismatch" });
      return;
    }
    res.type("text/html").send(`google-site-verification: google${token}.html\n`);
  });

  // security.txt (RFC 9116)
  router.get("/.well-known/security.txt", (_req: Request, res: Response) => {
    const m = buildDirectoryMetadata();
    const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    res
      .type("text/plain")
      .send(
        [
          `Contact: mailto:${m.publisher.supportEmail}`,
          `Expires: ${expires}`,
          `Preferred-Languages: ja, en, id`,
          `Canonical: ${m.urls.baseUrl}/.well-known/security.txt`,
          `Policy: ${m.urls.security}`,
          "",
        ].join("\n"),
      );
  });

  // robots / sitemap
  router.get("/robots.txt", (_req: Request, res: Response) => {
    const m = buildDirectoryMetadata();
    res
      .type("text/plain")
      .send([`User-agent: *`, `Allow: /`, `Sitemap: ${m.urls.baseUrl}/sitemap.xml`, ""].join("\n"));
  });

  router.get("/sitemap.xml", (_req: Request, res: Response) => {
    const m = buildDirectoryMetadata();
    const lastmod = new Date().toISOString().slice(0, 10);
    const entries: { loc: string; priority: string; changefreq: string }[] = [
      { loc: "/", priority: "1.0", changefreq: "weekly" },
      { loc: "/privacy", priority: "0.5", changefreq: "monthly" },
      { loc: "/terms", priority: "0.5", changefreq: "monthly" },
      { loc: "/security", priority: "0.5", changefreq: "monthly" },
      { loc: "/support", priority: "0.7", changefreq: "monthly" },
      { loc: "/.well-known/mcp/server-card.json", priority: "0.6", changefreq: "weekly" },
      { loc: "/.well-known/ai-plugin.json", priority: "0.6", changefreq: "weekly" },
    ];
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${m.urls.baseUrl}${e.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`,
    );
  });

  return router;
}

function staticFileHandler(relPath: string, contentType: string) {
  return (_req: Request, res: Response) => {
    const abs = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ error: `${relPath} not found` });
      return;
    }
    // 短めの TTL (5 分) にしてブランド差し替え時の伝播を速くする。
    // Short TTL so brand refreshes propagate quickly through any CDN.
    // TTL pendek supaya pembaruan merek cepat tersebar lewat CDN.
    res
      .type(contentType)
      .setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
      .sendFile(abs);
  };
}
