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
import { apiRateLimiter } from "./middleware/rate-limiter.js";

// REST API & Plugin Meta routes
import toolsRestRouter from "./routes/tools-rest.js";
import pluginMetaRouter from "./routes/plugin-meta.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",
  methods: "GET, POST, DELETE, OPTIONS",
  exposedHeaders: ["Mcp-Session-Id"]
}));

// ─── 認証とレートリミット ───
app.use(apiKeyAuth);
app.use("/mcp", apiRateLimiter);

// ─── ヘルスチェック ───
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "suguvisa-mcp",
    version: "0.2.0",
    modes: {
      mcp: "/mcp (Claude.ai Remote MCP)",
      rest: "/api/v1/tools/* (GPT Actions / REST API)",
      standalone: process.env.ENABLE_STANDALONE_CHAT === "true" ? "enabled" : "disabled",
    },
    tools: 15,
  });
});

// ─── Plugin Discovery & Metadata (GPT) ───
app.use(pluginMetaRouter);

// ─── REST API (GPT Actions / External) ───
app.use("/api/v1/tools", toolsRestRouter);

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

  try {
    const server = new McpServer({
      name: "suguvisa-mcp",
      version: "0.2.0",
      description: "特定技能ビザ申請の専門MCPサーバー（Claude & GPT デュアルプラグイン）",
    });

    registerAllTools(server);

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
  console.error(`🛂 SuguVisa Dual Plugin Server v0.2.0 listening on port ${PORT}`);
  console.error(`   MCP endpoint (Claude):   http://localhost:${PORT}/mcp`);
  console.error(`   REST API (GPT Actions):  http://localhost:${PORT}/api/v1/tools/`);
  console.error(`   OpenAPI spec:            http://localhost:${PORT}/openapi.yaml`);
  console.error(`   Plugin manifest:         http://localhost:${PORT}/.well-known/ai-plugin.json`);
  console.error(`   Health check:            http://localhost:${PORT}/health`);
  if (!process.env.SUGUVISA_API_KEY) {
    console.error("   ⚠️  認証未設定（SUGUVISA_API_KEY 環境変数で有効化）");
  }
  if (process.env.ENABLE_STANDALONE_CHAT !== "true") {
    console.error("   ℹ️  Standalone chat mode disabled (set ENABLE_STANDALONE_CHAT=true to enable)");
  }
});

