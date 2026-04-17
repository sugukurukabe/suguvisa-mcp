/**
 * ゴールデンレコード関連の MCP Resource
 * MCP resources for Golden Records (ground-truth knowledge base)
 * Resource MCP untuk Golden Records (basis pengetahuan ground-truth)
 *
 * Phase 2 Task 2.1 で実装したゴールデンレコードのうち、
 * - ローカル（src/data/golden-records-registry.json）のレジストリは常に公開
 * - Firestore に接続していれば、実データを type ごとに公開する
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GOLDEN_RECORD_TYPES,
  type GoldenRecord,
  type GoldenRecordStore,
  type GoldenRecordType,
} from "@suguvisa/golden-records";
import { jsonResource, loadJson } from "./util.js";

const KNOWN_TYPES: GoldenRecordType[] = [...GOLDEN_RECORD_TYPES];

interface RegistryFile {
  description?: string;
  records: Array<Record<string, unknown>>;
}

/**
 * オプションで GoldenRecordStore を差し込めば Firestore 実体も公開する
 * Optionally inject a GoldenRecordStore to expose live records
 */
export function registerGoldenRecordResources(
  server: McpServer,
  options: { store?: GoldenRecordStore } = {},
): void {
  const store = options.store;

  server.registerResource(
    "golden_records_registry",
    "suguvisa://golden-records/registry",
    {
      title: "ゴールデンレコード・レジストリ (ローカル)",
      description:
        "SuguVisa AI 審査・生成で Ground Truth として参照する完全形ケースのレジストリ。評価ベンチマークにも使用。",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadJson<RegistryFile>("golden-records-registry.json");
      return jsonResource("suguvisa://golden-records/registry", {
        description: registry.description,
        total: registry.records.length,
        records: registry.records,
      });
    },
  );

  server.registerResource(
    "golden_records_types",
    "suguvisa://golden-records/types",
    {
      title: "ゴールデンレコード種別一覧",
      description:
        "Golden Records が取り扱う種別（rule / procedure / document_template / faq / precedent / glossary）。",
      mimeType: "application/json",
    },
    async () => {
      return jsonResource("suguvisa://golden-records/types", {
        types: KNOWN_TYPES.map((t) => ({
          id: t,
          description: describeType(t),
        })),
      });
    },
  );

  if (!store) return;

  server.registerResource(
    "golden_records_by_type",
    new ResourceTemplate("suguvisa://golden-records/{type}", {
      list: async () => ({
        resources: KNOWN_TYPES.map((t) => ({
          uri: `suguvisa://golden-records/${t}`,
          name: `golden_records_${t}`,
          title: `Golden Records — ${t}`,
          description: describeType(t),
          mimeType: "application/json",
        })),
      }),
      complete: {
        type: async (value: string) =>
          KNOWN_TYPES.filter((t) => t.startsWith(value.toLowerCase())),
      },
    }),
    {
      title: "Golden Records (type 別)",
      description:
        "指定された type の golden records を最大 50 件返す。Firestore 接続時のみ有効。",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const type = String(variables.type) as GoldenRecordType;
      if (!KNOWN_TYPES.includes(type)) {
        return jsonResource(uri.toString(), {
          error: "unknown_type",
          type,
          valid_types: KNOWN_TYPES,
        });
      }
      try {
        const records = await store.list({ types: [type], includeGlobal: true });
        return jsonResource(uri.toString(), {
          type,
          total: records.length,
          records: records.map(redactRecord),
        });
      } catch (err) {
        return jsonResource(uri.toString(), {
          error: "store_error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}

function describeType(type: GoldenRecordType): string {
  switch (type) {
    case "visa_rule":
      return "入管法・通達・運用要領から抽出したビザ関連ルール";
    case "official_document":
      return "公式ドキュメント（通達・告示等）";
    case "industry_field":
      return "特定産業分野の情報";
    case "nationality":
      return "国籍別の手続き・要件情報";
    case "company_master":
      return "企業マスタ（登録支援機関・受入れ機関等）";
    case "case_precedent":
      return "過去の申請事例・判断事例";
    case "form_template":
      return "参考様式・申請書類のテンプレート";
    case "faq":
      return "よくある質問と回答";
  }
}

function redactRecord(r: GoldenRecord): Omit<GoldenRecord, "embedding"> {
  // 埋め込みベクトルは resource には出さない
  const { embedding: _embedding, ...rest } = r;
  void _embedding;
  return rest;
}
