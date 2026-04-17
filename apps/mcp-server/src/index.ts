#!/usr/bin/env node
/**
 * SuguVisa MCP — エントリポイント (Smithery SDK 対応)
 *
 * Smithery Session Configuration + stdio 両対応。
 * - Smithery: export { configSchema } + export default createServer
 * - ローカル: npx suguvisa-mcp / Claude Desktop / Cursor
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./register-tools.js";
import { instrumentMcpServer } from "@suguvisa/observability";
import { z } from "zod";

// ─── Smithery Session Configuration Schema ───
// Smithery が自動的にOAuth UIフォームを生成するためのスキーマ。
export const configSchema = z.object({
  plan: z
    .enum(["free", "pro", "enterprise"])
    .default("free")
    .describe(
      "利用プラン / Subscription plan: free=basic 5 tools, pro=all 24 tools, enterprise=audit+tenant"
    ),
  apiKey: z
    .string()
    .default("")
    .describe(
      "Enterprise用APIキー（free/pro不要）/ API key for Enterprise plan only"
    ),
  gcpProjectId: z
    .string()
    .default("")
    .describe(
      "在留カードOCR・法務文書検索用GCPプロジェクトID（任意）/ GCP Project ID for OCR & legal search (optional)"
    ),
});

// ─── Smithery createServer ───
// Smithery SDK がリモートサーバーを起動するときに呼ぶ関数。
export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: "suguvisa-mcp",
    version: "0.9.0",
    description:
      "特定技能ビザ申請を完全自動化するAIエージェントサーバー。24ツール搭載。在留カード→申請判定→書類リスト→理由書生成→テンプレート生成を自動連鎖実行。",
  });

  // プランと設定をプロセス環境変数に伝搬
  if (config.plan) process.env.SUGUVISA_PLAN = config.plan;
  if (config.apiKey) process.env.SUGUVISA_API_KEY = config.apiKey;
  if (config.gcpProjectId)
    process.env.GCP_PROJECT_ID = config.gcpProjectId;

  registerAllTools(server);
  instrumentMcpServer(server);

  return server.server;
}

// ─── ローカル stdio モード ───
// npx suguvisa-mcp で直接起動された場合のみ実行
const isDirectRun =
  process.argv[1]?.endsWith("index.js") ||
  process.argv[1]?.endsWith("index.ts");

if (isDirectRun) {
  const server = new McpServer({
    name: "suguvisa-mcp",
    version: "0.9.0",
    description:
      "特定技能ビザ申請を完全自動化するAIエージェントサーバー。24ツール搭載。",
  });

  registerAllTools(server);
  instrumentMcpServer(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    "🛂 SuguVisa MCP server running (stdio, 24 tools, 7 prompts, 6 resources)"
  );
}
