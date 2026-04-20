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

import {
  createAuthProvider,
  createAuthMiddleware,
  generateResourceMetadata,
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

const app = express();

// Cloud Run / Cloud Armor の背後にいるので X-Forwarded-For を信頼する。
// Trust X-Forwarded-For when running behind Cloud Run / Cloud Armor.
// Percayai X-Forwarded-For saat berjalan di belakang Cloud Run / Cloud Armor.
app.set("trust proxy", 1);

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
        .select("id, key, status, tenant_id, tenants (id, organization_name, subscription_plan, status)")
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
      "/favicon.svg",
      "/favicon.ico",
      "/og-image.svg",
      "/og-image.png",
      "/robots.txt",
      "/sitemap.xml",
      "/api/v1/billing/plans",
      "/api/v1/billing/webhook",
    ]);
    const publicPrefixes = ["/.well-known/", "/assets/"];
    if (publicExact.has(req.path) || publicPrefixes.some(p => req.path.startsWith(p))) {
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
          .select("id, organization_name, subscription_plan, status")
          .eq(auth0Sub ? "auth0_sub" : "id", auth0Sub ?? principal.tenantId)
          .eq("status", "active")
          .maybeSingle();

        // Auth0 ユーザーの初回アクセス時にテナントを自動作成
        // Auto-provision tenant on first access for Auth0 users
        // Buat tenant otomatis saat akses pertama untuk user Auth0
        if (!tenant && auth0Sub) {
          const defaultOrgName =
            (principal.email ? principal.email.split("@")[0] : null) ??
            `Tenant-${auth0Sub.slice(0, 12)}`;
          const { data: created, error: insertError } = await supabase
            .from("tenants")
            .insert({
              auth0_sub: auth0Sub,
              organization_name: defaultOrgName,
              subscription_plan: "free",
              status: "active",
            })
            .select("id, organization_name, subscription_plan, status")
            .maybeSingle();
          if (insertError) {
            console.error("[auth-bridge] auto-provision failed:", insertError);
          } else {
            tenant = created;
            console.log(`[auth-bridge] auto-provisioned tenant for ${auth0Sub}: ${created?.id}`);
          }
        }

        if (tenant) {
          req.tenant = {
            id: tenant.id,
            organization_name: tenant.organization_name,
            subscription_plan: tenant.subscription_plan,
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
// Sensitive endpoints — aggressive limit to slow down scrapers / brute force.
// Endpoint sensitif — batas ketat untuk memperlambat scraper / brute force.
app.use(
  "/.well-known",
  createRateLimiter(rateLimitPresets.sensitive),
);

// ─── レート制限 (第三層: /mcp プラン別) ───
// Plan-aware per-tenant limit kept for backward compatibility with Supabase tenants.
// Batas per-tenant berbasis paket tetap untuk kompatibilitas dengan tenant Supabase.
app.use("/mcp", apiRateLimiter);

// ─── OAuth 2.1 Discovery Endpoints ───
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  const metadata = generateResourceMetadata(authConfig);
  res.json(metadata);
});

if (oauthEnabled && authProvider) {
  app.get("/.well-known/oauth-authorization-server", async (_req, res) => {
    try {
      const metadata = await authProvider.getAuthorizationServerMetadata();
      res.json(metadata);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[OAuth] Failed to fetch AS metadata:", message);
      res.status(502).json({ error: "Failed to fetch authorization server metadata" });
    }
  });
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

