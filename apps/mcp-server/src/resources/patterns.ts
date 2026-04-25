/**
 * 申請パターン関連のリソース
 * Application pattern MCP resources
 * Resource MCP terkait pola permohonan
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResource, loadJson } from "./util.js";

interface RuleSets {
  application_patterns: Record<string, Pattern>;
}

interface Pattern {
  id: string;
  formal_name: string;
  short_name?: string;
  form_code?: string;
  from_visa?: string;
  to_visa?: string;
  description?: string;
  typical_processing_days?: string;
  exam_exemption?: Record<string, unknown>;
  skip_conditions?: unknown[];
  required_documents?: unknown[];
  notes?: string[];
}

export function registerPatternResources(server: McpServer): void {
  server.registerResource(
    "visa_patterns_list",
    "suguvisa://patterns/list",
    {
      title: "全申請パターン一覧 / All application patterns",
      description:
        "特定技能ビザの全申請パターン（変更・更新・認定・転職等）のID・正式名称・処理期間を一覧で取得。suguvisa_application_type_determine を呼ぶ前のオリエンテーションに使える。",
      mimeType: "application/json",
    },
    async () => {
      const ruleSets = loadJson<RuleSets>("rule-sets.json");
      const patterns = Object.values(ruleSets.application_patterns).map((p) => ({
        id: p.id,
        formal_name: p.formal_name,
        short_name: p.short_name,
        from_visa: p.from_visa,
        to_visa: p.to_visa,
        description: p.description,
        typical_processing_days: p.typical_processing_days,
      }));
      return jsonResource("suguvisa://patterns/list", {
        total: patterns.length,
        patterns,
      });
    },
  );

  server.registerResource(
    "visa_pattern_detail",
    new ResourceTemplate("suguvisa://patterns/{id}", {
      list: async () => {
        const ruleSets = loadJson<RuleSets>("rule-sets.json");
        return {
          resources: Object.values(ruleSets.application_patterns).map((p) => ({
            uri: `suguvisa://patterns/${p.id}`,
            name: `visa_pattern_${p.id}`,
            title: `${p.id} — ${p.formal_name}`,
            description: p.description ?? p.formal_name,
            mimeType: "application/json",
          })),
        };
      },
      complete: {
        id: async (value: string) => {
          const ruleSets = loadJson<RuleSets>("rule-sets.json");
          const ids = Object.keys(ruleSets.application_patterns);
          return ids.filter((id) => id.toLowerCase().startsWith(value.toLowerCase()));
        },
      },
    }),
    {
      title: "申請パターン詳細 / Application pattern detail",
      description:
        "指定された申請パターン ID の完全な詳細 (様式番号・処理日数・試験免除条件・必要書類・注記) を返す。",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const id = String(variables.id);
      const ruleSets = loadJson<RuleSets>("rule-sets.json");
      const pattern = ruleSets.application_patterns[id];
      if (!pattern) {
        return jsonResource(uri.toString(), {
          error: `pattern_not_found`,
          id,
          hint:
            "利用可能な ID 一覧は suguvisa://patterns/list で取得できます。",
        });
      }
      return jsonResource(uri.toString(), pattern);
    },
  );
}
