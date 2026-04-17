/**
 * 参考様式リソース
 * Reference form MCP resources
 * Resource MCP untuk formulir referensi
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResource, loadJson } from "./util.js";

interface ReferenceForms {
  source_url?: string;
  forms: Record<string, Form>;
}

interface Form {
  number: string;
  name: string;
  category?: string;
  required_for?: string[];
  bilingual?: boolean;
  bilingual_languages?: string[];
  who?: string;
  fields?: string[];
  notes?: string;
}

export function registerFormResources(server: McpServer): void {
  server.registerResource(
    "reference_forms_list",
    "suguvisa://forms/list",
    {
      title: "参考様式一覧 / Reference forms",
      description:
        "出入国在留管理庁が公開する特定技能関連の参考様式一覧。様式番号・名称・カテゴリ・記入者・バイリンガル対応状況を含む。",
      mimeType: "application/json",
    },
    async () => {
      const refForms = loadJson<ReferenceForms>("reference-forms.json");
      const forms = Object.entries(refForms.forms).map(([key, data]) => ({
        key,
        number: data.number,
        name: data.name,
        category: data.category,
        who: data.who,
        bilingual: data.bilingual,
        bilingual_languages: data.bilingual_languages,
      }));
      return jsonResource("suguvisa://forms/list", {
        total: forms.length,
        source_url: refForms.source_url,
        forms,
      });
    },
  );

  server.registerResource(
    "reference_form_detail",
    new ResourceTemplate("suguvisa://forms/{key}", {
      list: async () => {
        const refForms = loadJson<ReferenceForms>("reference-forms.json");
        return {
          resources: Object.entries(refForms.forms).map(([key, data]) => ({
            uri: `suguvisa://forms/${key}`,
            name: `reference_form_${key}`,
            title: `${data.number} — ${data.name}`,
            description: `${data.category ?? "参考様式"}: ${data.name}`,
            mimeType: "application/json",
          })),
        };
      },
      complete: {
        key: async (value: string) => {
          const refForms = loadJson<ReferenceForms>("reference-forms.json");
          return Object.keys(refForms.forms).filter((k) => k.startsWith(value));
        },
      },
    }),
    {
      title: "参考様式詳細 / Reference form detail",
      description:
        "指定された様式キー（例: 1-2, 1-5, 2-1）の完全な情報（項目名・記入者・バイリンガル・必要シナリオ）を返す。",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const key = String(variables.key);
      const refForms = loadJson<ReferenceForms>("reference-forms.json");
      const form = refForms.forms[key];
      if (!form) {
        return jsonResource(uri.toString(), {
          error: "form_not_found",
          key,
          hint: "利用可能な参考様式キー一覧は suguvisa://forms/list で取得できます。",
        });
      }
      return jsonResource(uri.toString(), { key, ...form });
    },
  );
}
