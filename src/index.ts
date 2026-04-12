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
  version: "0.2.0",
  description:
    "日本の特定技能ビザ申請を自動化するAIサーバー。行政書士・登録支援機関・受入れ機関向け。18種のツールで申請種別の自動判定、130パターン対応の必要書類リスト、省略条件の自動適用、14日届出ルールの期限計算、入管オンライン申請CSV/Excel生成、紙申請PDFマッピング、在留カードOCR、法改正の自動追跡、申請結果の統計分析を提供。Claude・ChatGPT・Cursor・Windsurf等のAIツールに直接組み込んで使える唯一のビザ申請プラットフォーム。",
});

registerAllTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("🛂 SuguVisa MCP server running (stdio, 9 tools)");
