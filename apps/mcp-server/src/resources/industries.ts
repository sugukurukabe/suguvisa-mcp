/**
 * 特定産業分野リソース
 * Specified industry fields MCP resources
 * Resource MCP untuk bidang industri tertentu
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResource, loadJson } from "./util.js";

interface FieldSpecific {
  fields: Record<string, Field>;
}

interface Field {
  code: string;
  industry_code?: string;
  skill_test?: { name?: string; organizer?: string; url?: string };
  japanese_test?: unknown;
  additional_documents?: Array<{ name: string; reference_form?: string; who?: string }>;
  dispatch_allowed?: boolean;
}

export function registerIndustryResources(server: McpServer): void {
  server.registerResource(
    "ssw_industries_list",
    "suguvisa://industries/list",
    {
      title: "特定産業分野一覧 / Specified industry fields",
      description:
        "特定技能1号の対象16分野のコード・試験情報・派遣可否を一覧で取得。分野ごとの技能試験名・実施機関・分野固有書類も含む。",
      mimeType: "application/json",
    },
    async () => {
      const fieldSpecific = loadJson<FieldSpecific>("field-specific.json");
      const industries = Object.entries(fieldSpecific.fields).map(([name, data]) => ({
        name,
        code: data.code,
        industry_code: data.industry_code,
        skill_test_name: data.skill_test?.name,
        skill_test_organizer: data.skill_test?.organizer,
        dispatch_allowed: data.dispatch_allowed ?? false,
        additional_documents_count: data.additional_documents?.length ?? 0,
      }));
      return jsonResource("suguvisa://industries/list", {
        total: industries.length,
        industries,
      });
    },
  );

  server.registerResource(
    "ssw_industry_detail",
    new ResourceTemplate("suguvisa://industries/{code}", {
      list: async () => {
        const fieldSpecific = loadJson<FieldSpecific>("field-specific.json");
        return {
          resources: Object.entries(fieldSpecific.fields).map(([name, data]) => ({
            uri: `suguvisa://industries/${data.code}`,
            name: `ssw_industry_${data.code}`,
            title: `${data.code} — ${name}`,
            description: `特定産業分野 ${name} の詳細 (技能試験・日本語試験・分野固有書類)。`,
            mimeType: "application/json",
          })),
        };
      },
      complete: {
        code: async (value: string) => {
          const fieldSpecific = loadJson<FieldSpecific>("field-specific.json");
          const codes = Object.values(fieldSpecific.fields).map((f) => f.code);
          return codes.filter((c) => c.startsWith(value));
        },
      },
    }),
    {
      title: "特定産業分野詳細 / Industry detail",
      description:
        "指定された分野コードの技能試験・日本語試験・分野固有書類・派遣可否の詳細を返す。",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const code = String(variables.code);
      const fieldSpecific = loadJson<FieldSpecific>("field-specific.json");
      const match = Object.entries(fieldSpecific.fields).find(([, data]) => data.code === code);
      if (!match) {
        return jsonResource(uri.toString(), {
          error: "industry_not_found",
          code,
          hint:
            "利用可能な分野コード一覧は suguvisa://industries/list で取得できます。",
        });
      }
      const [name, data] = match;
      return jsonResource(uri.toString(), { name, ...data });
    },
  );
}
