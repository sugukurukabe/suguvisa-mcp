#!/usr/bin/env node
/**
 * SuguVisa MCP — HTTP エントリポイント (Dual Plugin Server)
 *
 * 3つのモードを同時に提供:
 *   1. MCP Protocol (/mcp) — Claude.ai Remote MCP
 *   2. REST API (/api/v1/tools/*) — GPT Actions / 外部API
 *   3. Standalone Chat (/api/v1/chatbot) — 自社フロントエンド用 (オプション)
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "./register-tools.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { logUsage } from "./middleware/usage-logger.js";
import type { AuthRequest } from "./middleware/auth.js";
import { apiRateLimiter, checkToolAccess } from "./middleware/rate-limiter.js";
import { securityHeaders } from "./middleware/security-headers.js";

import {
  createAuthProvider,
  createAuthMiddleware,
  generateResourceMetadata,
  ALL_SCOPES,
  type AuthConfig,
  type Principal,
} from "@suguvisa/auth";
import {
  createRateLimiter,
  rateLimitPresets,
  createRedisStore,
} from "@suguvisa/core/rate-limit";
import {
  obsMiddleware,
  initOtel,
  withObsContext,
  getObsContext,
  updateObsContext,
  getMetrics,
  getLlmTracer,
  newRequestId,
  instrumentMcpServer,
} from "@suguvisa/observability";
import { supabase } from "./lib/supabase.js";
import { getToolScopes } from "./lib/tool-scopes.js";
import { verifySupabaseJwt, looksLikeJwt } from "./lib/supabase-jwt.js";

// REST API & Plugin Meta routes
import toolsRestRouter from "./routes/tools-rest.js";
import { createDirectoryRouter } from "./routes/directory/index.js";
import tenantRouter from "./routes/tenant.js";
import billingRouter, { billingWebhookHandler } from "./routes/billing.js";
import { oauthRegisterHandler } from "./routes/oauth-register.js";
import { isAuth0MgmtConfigured } from "./lib/auth0-management.js";

const app = express();

// Cloud Run / Cloud Armor の背後にいるので X-Forwarded-For を信頼する。
// Trust X-Forwarded-For when running behind Cloud Run / Cloud Armor.
// Percayai X-Forwarded-For saat berjalan di belakang Cloud Run / Cloud Armor.
app.set("trust proxy", 1);

// ─── セキュリティヘッダ (CSP / HSTS / nosniff / frame-options) ───
// ChatGPT Apps Store / Claude Connectors Directory のどちらも提出要件として CSP を求める。
// 全レスポンスに共通で付与し、HTML 以外 (JSON / アセット) でも同じ値を返す。
// 注意: Stripe webhook (raw body) ハンドラより前に入れると webhook レスポンスにも
// 影響するが、webhook は Stripe 以外読まないためヘッダ有無はどちらでも動作する。
app.use(securityHeaders());

// ─── OpenTelemetry 初期化（optional） ───
// Initialize OpenTelemetry if OTEL_* env vars are set.
// Inisialisasi OpenTelemetry jika variabel OTEL_* disetel.
const otelExporter = (process.env.OTEL_EXPORTER ?? "none") as "none" | "google" | "otlp";
if (otelExporter !== "none") {
  await initOtel({
    serviceName: "suguvisa-mcp",
    serviceVersion: process.env.APP_VERSION ?? "0.9.4",
    exporter: otelExporter,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    gcpProjectId: process.env.GCP_PROJECT_ID,
  }).catch((err: unknown) => {
    console.error("[otel] init failed:", err);
  });
}

// ─── Stripe Webhook (RAW body) ───
// Mounted BEFORE express.json() so Stripe signature verification works.
// Must stay before any body-parsing middleware.
app.post(
  "/api/v1/billing/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  billingWebhookHandler,
);

app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin: "*",
  methods: "GET, POST, DELETE, OPTIONS",
  exposedHeaders: ["Mcp-Session-Id", "X-Request-Id"]
}));

// ─── Observability ミドルウェア（全リクエストに request_id / span を付与） ───
// Observability middleware — request_id / span on every request.
// Middleware observability — request_id / span pada setiap permintaan.
app.use(obsMiddleware());

// ─── レート制限 (第一層: IP グローバル) ───
// Global IP-based limiter — first line of defense against floods.
// Pembatas IP global — pertahanan pertama terhadap banjir permintaan.
const globalRateLimitStore = process.env.REDIS_URL
  ? await createRedisStore({
      url: process.env.REDIS_URL,
      prefix: "suguvisa-rl:global:",
    }).catch((err) => {
      console.error("[rate-limit] Redis store failed, falling back to memory:", err.message);
      return undefined;
    })
  : undefined;

app.use(
  createRateLimiter({
    ...rateLimitPresets.global,
    store: globalRateLimitStore,
  }),
);

// ─── OAuth 2.1 設定 / OAuth 2.1 Configuration / Konfigurasi OAuth 2.1 ───
const authConfig: AuthConfig = {
  domain: process.env.AUTH0_DOMAIN ?? '',
  audience: process.env.AUTH0_AUDIENCE ?? process.env.SUGUVISA_BASE_URL ?? 'https://mcp.suguvisa.com',
  issuerBaseUrl: process.env.AUTH0_ISSUER_BASE_URL ?? '',
  allowLegacyApiKey: process.env.ALLOW_LEGACY_API_KEY !== 'false',
};

const oauthEnabled = Boolean(authConfig.domain && authConfig.issuerBaseUrl);
const authProvider = oauthEnabled ? createAuthProvider(authConfig) : null;

/**
 * 実効プラン判定 / Effective plan resolution / Resolusi paket efektif
 *
 * ルール:
 *   - subscription_plan が starter / professional / unlimited → それをそのまま採用
 *   - それ以外 (free など) で ticket_expires_at が未来なら 'starter' として扱う (チケット効果)
 *   - それ以外はサブスクの値 (typically 'free') をそのまま返す
 *
 * Rules:
 *   - If subscription_plan is starter/professional/unlimited, return it as-is.
 *   - Else if ticket_expires_at > now(), return 'starter' (ticket grants Starter access).
 *   - Else return the raw subscription_plan (usually 'free').
 */
function resolveEffectivePlan(tenant: {
  subscription_plan?: string | null;
  ticket_expires_at?: string | null;
}): string {
  const sub = (tenant.subscription_plan ?? "free").toString();
  if (sub === "starter" || sub === "professional" || sub === "unlimited") return sub;
  const expiry = tenant.ticket_expires_at ? new Date(tenant.ticket_expires_at).getTime() : 0;
  if (expiry > Date.now()) return "starter";
  return sub;
}

async function legacyApiKeyValidator(key: string): Promise<Principal | null> {
  const localApiKey = process.env.SUGUVISA_API_KEY;
  if (localApiKey && key === localApiKey) {
    return {
      sub: 'local-dev-user',
      tenantId: 'local-dev-tenant',
      scopes: [],
      iss: 'legacy',
      aud: authConfig.audience,
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
  }

  // 1) Supabase Auth JWT (ダッシュボードから直接叩く経路)
  //    Dashboard が session.access_token をそのまま Authorization ヘッダに載せて送る。
  //    The dashboard forwards Supabase's session.access_token verbatim.
  if (looksLikeJwt(key)) {
    const supaPrincipal = await verifySupabaseJwt(key, authConfig.audience);
    if (supaPrincipal) {
      return {
        sub: supaPrincipal.sub,
        tenantId: supaPrincipal.tenantId,
        scopes: [],
        email: supaPrincipal.email,
        iss: supaPrincipal.iss,
        aud: supaPrincipal.aud,
        exp: supaPrincipal.exp,
      };
    }
    // JWT 形式だが Supabase で検証できない場合はそのまま落として次へ。
  }

  // 2) Supabase に保存された長期 API キー (従来の svmcp_... プレフィックス)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const { data: apiKeyData } = await supabase
        .from("api_keys")
        .select("id, key, status, tenant_id, tenants (id, organization_name, subscription_plan, ticket_expires_at, status)")
        .eq("key", key)
        .eq("status", "active")
        .single();

      if (!apiKeyData) return null;
      const tenant = Array.isArray(apiKeyData.tenants) ? apiKeyData.tenants[0] : apiKeyData.tenants;
      if (!tenant || (tenant as { status?: string }).status !== 'active') return null;

      return {
        sub: `api-key:${apiKeyData.id}`,
        tenantId: (tenant as { id: string }).id,
        scopes: [],
        iss: 'legacy',
        aud: authConfig.audience,
        exp: Math.floor(Date.now() / 1000) + 86400,
      };
    } catch {
      return null;
    }
  }

  return null;
}

// ─── 認証とレートリミット ───
// OAuth 2.1 有効時は新しいミドルウェアを使用、無効時は既存の apiKeyAuth を使用
if (oauthEnabled && authProvider) {
  const resourceMetadataUrl = `${authConfig.audience}/.well-known/oauth-protected-resource`;
  const oauthMiddleware = createAuthMiddleware(authProvider, {
    resourceMetadataUrl,
    legacyApiKeyValidator: authConfig.allowLegacyApiKey ? legacyApiKeyValidator : undefined,
  });

  app.use((req, res, next) => {
    const publicExact = new Set([
      "/",
      "/health",
      "/openapi.yaml",
      "/privacy",
      "/terms",
      "/security",
      "/support",
      "/docs",
      "/logo.svg",
      "/logo.png",
      "/icon-1024.png",
      "/icon-512.png",
      "/icon-256.png",
      "/apple-touch-icon.png",
      "/favicon.svg",
      "/favicon.ico",
      "/favicon-32.png",
      "/og-image.svg",
      "/og-image.png",
      "/robots.txt",
      "/sitemap.xml",
      "/api/v1/billing/plans",
      "/api/v1/billing/webhook",
      "/oauth/register",
      "/authorize",
    ]);
    const publicPrefixes = ["/.well-known/", "/assets/"];
    // Google Search Console の HTML ファイル検証パス (例: /googleabc123.html) も
    // 認証不要 (Google クローラが匿名アクセスするため)。
    const isGoogleVerification = /^\/google[a-z0-9]+\.html$/i.test(req.path);
    if (
      publicExact.has(req.path) ||
      publicPrefixes.some((p) => req.path.startsWith(p)) ||
      isGoogleVerification
    ) {
      return next();
    }
    return oauthMiddleware(req, res, next);
  });

  // principal → tenant ブリッジ
  // OAuth middleware は req.principal をセットするが、既存ハンドラは req.tenant を参照するため、
  // principal.tenantId から tenants を解決して AuthRequest.tenant にアタッチする。
  app.use(async (req: AuthRequest, _res, next) => {
    const principal = req.principal;
    if (!principal || req.tenant) return next();
    if (principal.tenantId === "local-dev-tenant") {
      req.tenant = {
        id: "local-dev-tenant",
        organization_name: "Local Environment",
        subscription_plan: "unlimited",
      };
      return next();
    }
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        // Auth0 発行のトークンかを iss で判定
        // Detect Auth0-issued tokens by iss
        // Deteksi token yang diterbitkan Auth0 dari iss
        const isAuth0Token = typeof principal.iss === "string" && principal.iss.includes(".auth0.com");
        const auth0Sub = isAuth0Token ? principal.sub : null;

        let { data: tenant } = await supabase
          .from("tenants")
          .select("id, organization_name, subscription_plan, ticket_expires_at, status")
          .eq(auth0Sub ? "auth0_sub" : "id", auth0Sub ?? principal.tenantId)
          .eq("status", "active")
          .maybeSingle();

        // Auth0 ユーザーの初回アクセス時にテナントを自動作成（14日Professionalトライアル）
        // Auto-provision tenant with 14-day Professional trial on first Auth0 access
        // Buat tenant otomatis dengan uji coba Professional 14 hari saat akses pertama
        if (!tenant && auth0Sub) {
          const defaultOrgName =
            (principal.email ? principal.email.split("@")[0] : null) ??
            `Tenant-${auth0Sub.slice(0, 12)}`;
          const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          const { data: created, error: insertError } = await supabase
            .from("tenants")
            .insert({
              auth0_sub: auth0Sub,
              organization_name: defaultOrgName,
              subscription_plan: "professional",
              subscription_status: "trialing",
              trial_ends_at: trialEndsAt,
              status: "active",
            })
            .select("id, organization_name, subscription_plan, ticket_expires_at, status")
            .maybeSingle();
          if (insertError) {
            console.error("[auth-bridge] auto-provision failed:", insertError);
          } else {
            tenant = created;
            console.log(
              `[auth-bridge] auto-provisioned tenant for ${auth0Sub}: ${created?.id} (professional trial until ${trialEndsAt})`,
            );
          }
        }

        if (tenant) {
          req.tenant = {
            id: tenant.id,
            organization_name: tenant.organization_name,
            subscription_plan: resolveEffectivePlan(tenant),
            raw_subscription_plan: (tenant.subscription_plan ?? "free").toString(),
            ticket_expires_at: tenant.ticket_expires_at ?? null,
          };
        }
      } catch (error) {
        console.error("[auth-bridge] tenant lookup failed:", error);
      }
    }
    next();
  });
} else {
  app.use(apiKeyAuth);
}

// ─── レート制限 (第二層: 機密エンドポイント) ───
// /.well-known discovery endpoints (RFC 8414 / 9728 / MCP Authorization spec) are
// intentionally open and must remain highly available — OAuth クライアント
// (Claude / Smithery の oauth4webapi / ChatGPT) は短時間に AS metadata・PRM bare・
// PRM suffix・JWKS を連続で取得するため、厳しい rate limit に当たると 429 で
// "unexpected HTTP status code" として discovery 全体が失敗する。
// Use the `global` preset (100 req/min/IP) here and keep the `sensitive` preset
// for true abuse-prone endpoints (DCR, login).
//
// OAuth クライアントの discovery フローは短時間に複数の well-known URL を叩くため、
// /.well-known 全体を緩めにし、実際にブルートフォースされる恐れのある /oauth/register
// にのみ sensitive レート制限を残す。
//
// Endpoint penemuan /.well-known harus tetap responsif; klien OAuth memanggil
// AS metadata, PRM, dan JWKS secara cepat. Kami pakai preset `global` di sini
// dan simpan `sensitive` untuk endpoint yang benar-benar rawan brute-force.
app.use("/.well-known", createRateLimiter(rateLimitPresets.global));
app.use("/oauth/register", createRateLimiter(rateLimitPresets.sensitive));

// ─── レート制限 (第三層: /mcp プラン別) ───
// Plan-aware per-tenant limit kept for backward compatibility with Supabase tenants.
// Batas per-tenant berbasis paket tetap untuk kompatibilitas dengan tenant Supabase.
app.use("/mcp", apiRateLimiter);

// ─── OAuth 2.1 Discovery Endpoints ───
// DCR Proxy 有効時は自分を authorization_server として広告する。
// When DCR proxy is enabled we advertise ourselves as the authorization server
// so that Claude / ChatGPT use our DCR endpoint (first-party clients).
// Saat proxy DCR aktif, kami mengumumkan diri sebagai authorization server
// agar klien melakukan DCR melalui proxy dan menjadi klien first-party.
function resolveMcpBaseUrl(req: express.Request): string {
  const configured =
    process.env.SUGUVISA_BASE_URL ?? authConfig.audience ?? undefined;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get("host") ?? "mcp.suguvisa.com";
  return `${req.protocol}://${host}`.replace(/\/$/, "");
}

// RFC 9728 + MCP Authorization spec (2025-06-18): clients probe the resource
// metadata using the suffix path pattern
// `/.well-known/oauth-protected-resource/<resource-path>`.
// For SuguVisa MCP the resource lives at `/mcp`, so we expose both the bare
// path (`/.well-known/oauth-protected-resource`) and the suffix path
// (`/.well-known/oauth-protected-resource/mcp`). The bare path describes the
// server itself and the suffix path describes the `/mcp` endpoint; strict
// OAuth clients (Smithery scanner, Claude Desktop) only accept HTTP 200 here
// and fail with OAUTH_RESPONSE_IS_NOT_CONFORM otherwise.
//
// RFC 9728 + MCP 認可仕様 (2025-06-18): クライアントは suffix path パターン
// `/.well-known/oauth-protected-resource/<resource-path>` で保護リソースメタデータ
// を取得する。SuguVisa MCP の資源は `/mcp` にあるため、bare path と suffix path の
// 両方を返す。厳格な検証ライブラリ (oauth4webapi) は 200 以外を受け付けない。
//
// RFC 9728 + spesifikasi otorisasi MCP (2025-06-18): klien mem-probe metadata
// resource menggunakan pola suffix path `/.well-known/oauth-protected-resource/
// <resource-path>`. Resource SuguVisa MCP berada di `/mcp`, jadi kami memapar
// keduanya. Validator ketat (oauth4webapi) tidak menerima status selain 200.
function resourceMetadataHandler(resourcePath: "" | "/mcp") {
  return (req: express.Request, res: express.Response) => {
    const metadata = generateResourceMetadata(authConfig);
    const baseUrl = resolveMcpBaseUrl(req);
    // DCR proxy 有効時は authorization_servers を自分のドメインに揃える。
    // AS メタデータの issuer (`${baseUrl}/`) と一致させるため末尾スラッシュを付ける。
    if (isAuth0MgmtConfigured()) {
      metadata.authorization_servers = [`${baseUrl}/`];
    }
    if (resourcePath) {
      metadata.resource = `${baseUrl}${resourcePath}`;
    }
    res.json(metadata);
  };
}

app.get("/.well-known/oauth-protected-resource", resourceMetadataHandler(""));
app.get(
  "/.well-known/oauth-protected-resource/mcp",
  resourceMetadataHandler("/mcp"),
);

if (oauthEnabled && authProvider) {
  // AS メタデータ (RFC 8414)。DCR Proxy が有効なら issuer/registration_endpoint を
  // 自分のドメインに書き換える。authorize/token/jwks は引き続き Auth0 を指す。
  // Authorization Server metadata (RFC 8414). When the DCR proxy is enabled we
  // rewrite issuer and registration_endpoint to our own domain while delegating
  // authorize/token/jwks to Auth0.
  app.get("/.well-known/oauth-authorization-server", async (req, res) => {
    try {
      const metadata = (await authProvider.getAuthorizationServerMetadata()) as Record<string, unknown>;
      if (isAuth0MgmtConfigured()) {
        const baseUrl = resolveMcpBaseUrl(req);
        metadata.issuer = `${baseUrl}/`;
        metadata.registration_endpoint = `${baseUrl}/oauth/register`;

        // authorize を自前プロキシに向ける。これにより Smithery / Claude が送る
        // RFC 8707 `resource` パラメータを Auth0 固有の `audience` に変換でき、
        // MCP リソース用 access token が取得できる（audience が無いと Auth0 は
        // 単なる OIDC access token を返してしまい、/mcp で 401 になる）。
        //
        // Route /authorize through our proxy so the RFC 8707 `resource` parameter
        // that Smithery/Claude send is translated into Auth0's mandatory
        // `audience` parameter. Without this translation, Auth0 issues a plain
        // OIDC access token and our /mcp endpoint returns 401.
        //
        // Arahkan /authorize melalui proxy kami agar parameter `resource` (RFC 8707)
        // yang dikirim Smithery/Claude diterjemahkan menjadi `audience` milik Auth0.
        // Tanpa terjemahan ini, Auth0 mengeluarkan token OIDC polos dan /mcp 401.
        metadata.authorization_endpoint = `${baseUrl}/authorize`;

        // Auth0 が返す token_endpoint_auth_methods_supported には "none" が含まれない
        // ことがあり、MCP クライアント (Claude Desktop 等) は PKCE + public client
        // (auth_method=none) でトークン交換を行うため、ここで "none" を補う。
        // Auth0's metadata may omit "none" even though we register PKCE public clients;
        // MCP clients like Claude Desktop rely on this flag to proceed with token exchange.
        // Metadata dari Auth0 kadang tidak mencantumkan "none", padahal klien PKCE public
        // (Claude, dsb.) membutuhkan informasi tersebut agar pertukaran token berjalan.
        const current = Array.isArray(metadata.token_endpoint_auth_methods_supported)
          ? (metadata.token_endpoint_auth_methods_supported as string[])
          : [];
        if (!current.includes("none")) {
          metadata.token_endpoint_auth_methods_supported = ["none", ...current];
        }

        // MCP クライアントが期待する PKCE の最低要件を明示する。
        // Advertise PKCE support explicitly for MCP clients.
        if (!Array.isArray(metadata.code_challenge_methods_supported)) {
          metadata.code_challenge_methods_supported = ["S256"];
        }

        // PRM が広告している MCP カスタム scope を AS メタデータにも合流させる。
        // oauth4webapi などの厳格な scanner は PRM.scopes_supported が AS.scopes_supported
        // の部分集合であることを期待するため、両者を一致させないと検出エラーになる。
        // Merge MCP custom scopes advertised in PRM into AS metadata so that
        // strict scanners (oauth4webapi) accept the PRM↔AS consistency check.
        // Gabungkan scope kustom MCP di PRM ke metadata AS agar scanner ketat
        // seperti oauth4webapi menerima konsistensi PRM↔AS.
        const currentScopes = Array.isArray(metadata.scopes_supported)
          ? (metadata.scopes_supported as string[])
          : [];
        const mergedScopes = Array.from(new Set([...ALL_SCOPES, ...currentScopes]));
        metadata.scopes_supported = mergedScopes;

        // RFC 8707 のサポートも明示。
        // Advertise RFC 8707 resource indicator support explicitly.
        metadata.resource_parameter_supported = true;
      }
      res.json(metadata);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[OAuth] Failed to fetch AS metadata:", message);
      res.status(502).json({ error: "Failed to fetch authorization server metadata" });
    }
  });

  // /authorize プロキシ: Smithery / Claude が送る RFC 8707 `resource` を Auth0 の
  // `audience` に変換して Auth0 の /authorize にリダイレクトする。
  //
  // /authorize proxy: translate RFC 8707 `resource` sent by Smithery/Claude into
  // Auth0's `audience` parameter, then 302 to Auth0's native /authorize endpoint.
  //
  // Proxy /authorize: terjemahkan `resource` (RFC 8707) dari Smithery/Claude
  // menjadi `audience` milik Auth0, lalu 302 ke /authorize Auth0.
  app.get("/authorize", (req, res) => {
    try {
      const auth0Domain = authConfig.domain;
      if (!auth0Domain) {
        res.status(500).json({ error: "auth0_domain_not_configured" });
        return;
      }
      const incoming = new URL(
        req.originalUrl,
        `${req.protocol}://${req.get("host") ?? "mcp.suguvisa.com"}`,
      );
      const target = new URL(`https://${auth0Domain}/authorize`);
      incoming.searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
      });

      // MCP spec の RFC 8707 `resource` は MCP endpoint の URL (例: /mcp サフィックス付き)
      // を指すが、Auth0 の API identifier はスラッシュ付き root (`authConfig.audience`)
      // で登録されている。Auth0 は audience が登録済みでなければ invalid_audience を返し、
      // ログイン画面すら出さずにエラー画面に飛ぶため、ここでは必ず authConfig.audience を
      // audience として上書きし、resource パラメータはそのまま Auth0 に渡す（参考情報として）。
      //
      // MCP's RFC 8707 `resource` points at the MCP endpoint (e.g. the /mcp suffix),
      // but the Auth0 API identifier is the slash-terminated root. Auth0 refuses
      // an unregistered audience with invalid_audience and never shows its login
      // page, so we force `audience` to authConfig.audience while leaving the
      // `resource` parameter intact for downstream introspection.
      //
      // `resource` (RFC 8707) MCP menunjuk ke endpoint MCP (mis. akhiran /mcp),
      // sementara Auth0 mengenali API hanya dengan identifier root-nya. Auth0
      // akan menolak audience yang tidak terdaftar dan tidak menampilkan layar
      // login, jadi kami memaksa audience = authConfig.audience.
      if (authConfig.audience) {
        target.searchParams.set("audience", authConfig.audience);
      }

      res.redirect(302, target.toString());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[OAuth] /authorize proxy failed:", message);
      res.status(500).json({ error: "authorize_proxy_failed", message });
    }
  });

  // RFC 7591 Dynamic Client Registration endpoint (proxies to Auth0 Management API).
  app.post("/oauth/register", oauthRegisterHandler);
}

// ─── ヘルスチェック ───
app.get("/health", (_req, res) => {
  const billingConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  res.json({
    status: "ok",
    server: "suguvisa-mcp",
    version: "0.9.4",
    auth: {
      oauth21: oauthEnabled ? "enabled" : "disabled",
      legacyApiKey: authConfig.allowLegacyApiKey ? "enabled" : "disabled",
      supabaseJwt: process.env.SUPABASE_URL ? "enabled" : "disabled",
    },
    billing: {
      mode: billingConfigured ? "stripe" : "disabled",
      status: billingConfigured ? "configured" : "not_configured",
      webhook: webhookConfigured ? "configured" : "not_configured",
    },
    modes: {
      mcp: "/mcp (Claude.ai Remote MCP)",
      rest: "/api/v1/tools/* (GPT Actions / REST API)",
      tenant: "/api/v1/tenant/* (SaaS Management)",
      billing: billingConfigured
        ? "/api/v1/billing/* (Stripe configured)"
        : "/api/v1/billing/* (Stripe not configured)",
      standalone: process.env.ENABLE_STANDALONE_CHAT === "true" ? "enabled" : "disabled",
    },
    tools: 42,
    prompts: 14,
    resources: 70,
  });
});

// ─── Directory listings & marketing pages (Claude Connectors / ChatGPT Apps) ───
// ディレクトリ掲載向け manifest / 法務ページ / ブランドアセット / ランディング
app.use(createDirectoryRouter());

// ─── REST API (GPT Actions / External) ───
app.use("/api/v1/tools", toolsRestRouter);

// ─── Tenant Management API ───
app.use("/api/v1/tenant", tenantRouter);

// ─── Billing API (Stripe) ───
// Webhook (POST /api/v1/billing/webhook) is mounted earlier with RAW body.
// Plans is public, checkout/portal require authentication.
app.use("/api/v1/billing", billingRouter);

// ─── Legacy REST endpoint (backward compat) ───
import { determinePattern } from "./tools/determine-application.js";
app.post("/api/v1/visa/determine", (req: AuthRequest, res) => {
  try {
    let { from_visa, to_visa, context, has_supervisor_experience } = req.body;
    if (to_visa === "特定技能2号" && has_supervisor_experience === false) {
      to_visa = "特定活動";
      context = "2号移行準備";
    }
    const result = determinePattern(from_visa, to_visa, context);
    res.json({ status: "success", data: result });
  } catch (error: any) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

// ─── MCP エンドポイント (Streamable HTTP) — Claude.ai Remote MCP ───
app.post("/mcp", async (req: AuthRequest, res) => {
  const startTime = Date.now();
  const isToolCall = req.body?.method === "tools/call";
  const toolName = isToolCall ? req.body?.params?.name : "unknown_tool";

  // 観測コンテキストに MCP 固有情報を追記
  // Enrich observability context with MCP-specific fields.
  // Perkaya konteks observability dengan kolom khusus MCP.
  updateObsContext({
    tenantId: req.tenant?.id,
    principalSubject: (req as Express.Request).principal?.sub,
    operation: isToolCall ? `mcp.tool.${toolName}` : `mcp.${req.body?.method ?? "request"}`,
    attrs: {
      "mcp.method": req.body?.method ?? "",
      "mcp.tool": toolName ?? "",
    },
  });

  try {
    // プランベースのツールアクセス制御
    if (isToolCall && toolName) {
      const access = checkToolAccess(toolName, req.tenant?.subscription_plan);
      if (!access.allowed) {
        console.error(
          `[mcp-plan] tool=${toolName} tenant=${req.tenant?.id ?? "?"} ` +
            `plan=${req.tenant?.subscription_plan ?? "?"} ` +
            `reason="${access.reason ?? "not allowed"}"`,
        );
        res.status(403).json({
          jsonrpc: "2.0",
          error: { code: -32003, message: access.reason || "Tool not available on your plan" },
          id: req.body?.id || null,
        });
        return;
      }

      // OAuth スコープチェック（認証済み principal がある場合のみ）
      const principal = (req as Express.Request).principal;
      if (oauthEnabled && principal && principal.iss !== 'legacy') {
        const requiredScopes = getToolScopes(toolName);
        const missing = requiredScopes.filter(s => !principal.scopes.includes(s));
        if (missing.length > 0) {
          console.error(
            `[mcp-scope] tool=${toolName} sub=${principal.sub} ` +
              `iss=${principal.iss} aud=${principal.aud} ` +
              `required=${JSON.stringify(requiredScopes)} ` +
              `present=${JSON.stringify(principal.scopes)} ` +
              `missing=${JSON.stringify(missing)}`,
          );
          res.status(403).json({
            jsonrpc: "2.0",
            error: { code: -32003, message: `Insufficient scope. Required: ${missing.join(', ')}` },
            id: req.body?.id || null,
          });
          return;
        }
      }
    }

    const server = new McpServer({
      name: "suguvisa-mcp",
      version: "0.9.4",
      description: "特定技能ビザ申請の専門MCPサーバー（Claude & GPT デュアルプラグイン）",
    });

    registerAllTools(server);
    instrumentMcpServer(server);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    res.on("finish", () => {
      if (isToolCall) {
        const duration = Date.now() - startTime;
        const status = (res.statusCode >= 200 && res.statusCode < 300) ? "success" : "error";
        logUsage(req, toolName, status, duration);
        // ─── observability: ツール call の metric と LlmTracer 送信 ───
        try {
          const metrics = getMetrics();
          metrics.counter("mcp.tool.calls", 1, { tool: toolName, status });
          metrics.histogram("mcp.tool.duration_ms", duration, { tool: toolName, status });
          const ctx = getObsContext() ?? {
            requestId: newRequestId(),
            operation: `mcp.tool.${toolName}`,
          };
          void getLlmTracer().traceToolCall(ctx, {
            tool: toolName,
            durationMs: duration,
            status: status as "success" | "error",
          });
        } catch (obsErr) {
          console.error("[observability] finish handler failed:", obsErr);
        }
      }
    });

    await server.connect(transport);
    await transport.handleRequest(req as any, res, req.body);
  } catch (error: any) {
    console.error("MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
    if (isToolCall) {
      const duration = Date.now() - startTime;
      logUsage(req, toolName, "error", duration, error?.message || "Unknown error");
      try {
        const metrics = getMetrics();
        metrics.counter("mcp.tool.calls", 1, { tool: toolName, status: "error" });
        metrics.histogram("mcp.tool.duration_ms", duration, { tool: toolName, status: "error" });
        const ctx = getObsContext() ?? {
          requestId: newRequestId(),
          operation: `mcp.tool.${toolName}`,
        };
        void getLlmTracer().traceToolCall(ctx, {
          tool: toolName,
          durationMs: duration,
          status: "error",
          errorMessage: error?.message,
        });
      } catch {
        /* ignore */
      }
    }
  }
});

// ─── GET /mcp, DELETE /mcp（プロトコル準拠） ───
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "GET not supported in stateless mode. Use POST." },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "DELETE not supported in stateless mode." },
    id: null,
  });
});

// ─── Standalone Chat Mode (Optional) ───
if (process.env.ENABLE_STANDALONE_CHAT === "true") {
  console.error("   🤖 Standalone chat mode enabled (Vertex AI)");

  // Lazy import to avoid loading Vertex AI deps when not needed
  import("./agents/chat-agent.js").then(({ processChatMessage }) => {
    app.post("/api/v1/chatbot", async (req: AuthRequest, res) => {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ status: "error", message: "messages array is required" });
        return;
      }
      try {
        const result = await processChatMessage(messages);
        res.json({ status: "success", reply: result });
      } catch (err: any) {
        console.error("Chatbot error:", err);
        res.status(500).json({ status: "error", message: err.message || "Failed to process chat" });
      }
    });
  }).catch((err) => {
    console.error("   ⚠️  Chat agent failed to load:", err.message);
  });

  // Visa workflow (also optional, Vertex AI dependent)
  import("./agents/visa-workflow/graph.js").then(({ visaWorkflowApp }) => {
    app.post("/api/v1/chat", async (req: AuthRequest, res) => {
      const { thread_id, applicant_data, resume_data } = req.body;
      if (!thread_id) {
        res.status(400).json({ status: "error", message: "thread_id is required" });
        return;
      }
      const config = { configurable: { thread_id } };
      try {
        if (resume_data) {
          await visaWorkflowApp.updateState(config, resume_data, "notification");
          const resultState = await visaWorkflowApp.invoke(null, config);
          const newSnapshot = await visaWorkflowApp.getState(config);
          if (newSnapshot.next && newSnapshot.next.includes("audit")) {
            res.json({ status: "waiting_for_human", missing_fields: newSnapshot.values.missing_fields });
            return;
          }
          res.json({ status: "completed", generated_documents: resultState.generated_documents });
        } else {
          await visaWorkflowApp.invoke({ applicant_data: applicant_data || {} }, config);
          const snapshot = await visaWorkflowApp.getState(config);
          if (snapshot.next && snapshot.next.includes("audit")) {
            res.json({ status: "waiting_for_human", missing_fields: snapshot.values.missing_fields });
            return;
          }
          res.json({ status: "completed" });
        }
      } catch (err: any) {
        res.status(500).json({ status: "error", message: err.message });
      }
    });
  }).catch((err) => {
    console.error("   ⚠️  Visa workflow agent failed to load:", err.message);
  });
}

// ─── サーバー起動 ───
const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.error(`🛂 SuguVisa MCP Server v0.9.4 listening on port ${PORT}`);
  console.error(`   MCP endpoint (Claude):   http://localhost:${PORT}/mcp`);
  console.error(`   REST API (GPT Actions):  http://localhost:${PORT}/api/v1/tools/`);
  console.error(`   Tenant Management:       http://localhost:${PORT}/api/v1/tenant/`);
  console.error(`   OpenAPI spec:            http://localhost:${PORT}/openapi.yaml`);
  console.error(`   Plugin manifest:         http://localhost:${PORT}/.well-known/ai-plugin.json`);
  console.error(`   PRM (RFC 9728):          http://localhost:${PORT}/.well-known/oauth-protected-resource`);
  console.error(`   Health check:            http://localhost:${PORT}/health`);
  console.error(`   Auth: OAuth 2.1 ${oauthEnabled ? 'ENABLED' : 'DISABLED'}, Legacy API Key ${authConfig.allowLegacyApiKey ? 'ENABLED' : 'DISABLED'}`);
  if (!oauthEnabled && !process.env.SUGUVISA_API_KEY) {
    console.error("   ⚠️  認証未設定（AUTH0_DOMAIN + SUGUVISA_API_KEY 環境変数で有効化）");
  }
  if (process.env.ENABLE_STANDALONE_CHAT !== "true") {
    console.error("   ℹ️  Standalone chat mode disabled (set ENABLE_STANDALONE_CHAT=true to enable)");
  }
});

