#!/usr/bin/env node
/**
 * SuguVisa MCP — stdio エントリポイント
 *
 * npx suguvisa-mcp / Claude Desktop / Cursor 用。
 * ローカル stdio トランスポートで MCP プロトコルを提供。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./register-tools.js";

const server = new McpServer({
  name: "suguvisa-mcp",
  version: "0.1.0",
  description:
    "特定技能1号・特定活動（特定技能準備）ビザ申請の専門MCPサーバー。申請種別判定、必要書類リスト、期限計算、入力シート生成、オンライン申請CSV生成、紙申請書PDF生成を提供。",
});

registerAllTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("🛂 SuguVisa MCP server running (stdio, 9 tools)");
