/**
 * SuguVisa スーパーアプリ構想を MCP resource として公開する。
 * Expose the SuguVisa super app blueprint as an MCP resource.
 * Mengekspos blueprint super app SuguVisa sebagai resource MCP.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SUGUVISA_SUPER_APP_BLUEPRINT } from "../lib/super-app-blueprint.js";
import { jsonResource } from "./util.js";

export function registerSuperAppResources(server: McpServer): void {
  server.registerResource(
    "super_app_blueprint",
    "suguvisa://super-app/blueprint",
    {
      title: "SuguVisa スーパーアプリ構想",
      description:
        "Google Calendar / Gmail / Drive / GCS / Vertex AI Search / 専門家レビューを統合した SuguVisa スーパーアプリの実装設計。",
      mimeType: "application/json",
    },
    async () => jsonResource("suguvisa://super-app/blueprint", SUGUVISA_SUPER_APP_BLUEPRINT),
  );
}
