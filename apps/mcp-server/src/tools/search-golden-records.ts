/**
 * Golden Records 検索ツール
 * Golden Records search tool
 * Alat pencarian Golden Records
 *
 * @suguvisa/golden-records の HybridRetriever を MCP ツールとして公開する。
 * 実装は依存注入（getRetriever）で提供し、本番では Firestore + Vertex AI、
 * 開発/CI では InMemory + Deterministic を使う。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  DeterministicEmbeddingProvider,
  formatHitsForPrompt,
  GLOBAL_TENANT_ID,
  GOLDEN_RECORD_TYPES,
  HybridRetriever,
  InMemoryGoldenRecordStore,
  type GoldenRecordStore,
  type Retriever,
  type SearchHit,
} from "@suguvisa/golden-records";

export interface GoldenRecordsContext {
  retriever: Retriever;
  store?: GoldenRecordStore;
}

let overrideContext: GoldenRecordsContext | undefined;

/**
 * テストや本番セットアップ時に差し替えるためのフック
 * Hook for overriding the retriever (tests / production setup)
 * Hook untuk mengganti retriever (pengujian / pengaturan produksi)
 */
export function setGoldenRecordsContext(ctx: GoldenRecordsContext | undefined): void {
  overrideContext = ctx;
}

/**
 * 既定のコンテキスト (InMemory + Deterministic)
 * Default in-process context used when none is provided
 * Konteks in-process default jika tidak disediakan
 */
function buildDefaultContext(): GoldenRecordsContext {
  const store = new InMemoryGoldenRecordStore();
  const embeddings = new DeterministicEmbeddingProvider(128);
  const retriever = new HybridRetriever({ store, embeddings });
  return { store, retriever };
}

let defaultContext: GoldenRecordsContext | undefined;

function getContext(): GoldenRecordsContext {
  if (overrideContext) return overrideContext;
  if (!defaultContext) {
    defaultContext = buildDefaultContext();
  }
  return defaultContext;
}

const searchArgs = {
  query: z
    .string()
    .min(1)
    .describe(
      "検索クエリ。自然言語または短いキーワードで指定。例: 「特定技能 1 号 試験 免除」",
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("返却件数。デフォルト 5、最大 20"),
  tenant_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "検索対象のテナント ID。指定しない場合はグローバル共有レコードのみを返す",
    ),
  include_global: z
    .boolean()
    .optional()
    .describe(
      "グローバル共有レコードも含めるか。tenant_id を指定した場合のみ有効。デフォルト true",
    ),
  types: z
    .array(z.enum(GOLDEN_RECORD_TYPES as unknown as [string, ...string[]]))
    .optional()
    .describe("絞り込む type の配列。未指定なら全て"),
};

/**
 * MCP ツール: search_golden_records
 */
export function registerSearchGoldenRecords(server: McpServer): void {
  server.tool(
    "search_golden_records",
    "【Golden Records 検索】信頼できる知識ベース（入管ルール、公式文書、産業分野マスタ、匿名化済み事例など）をハイブリッド検索（BM25 + Vector）で横断検索。結果は引用付きで返却されるため、LLM の回答根拠として利用可能。 / Hybrid search (BM25 + Vector) across the Golden Records knowledge base for citation-grounded answers.",
    searchArgs,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ query, topK, tenant_id, include_global, types }) => {
      try {
        const ctx = getContext();
        const effectiveTenant = tenant_id ?? GLOBAL_TENANT_ID;
        const hits = await ctx.retriever.search({
          query,
          topK: topK ?? 5,
          filter: {
            tenantId: effectiveTenant,
            includeGlobal: include_global ?? true,
            types: types as typeof GOLDEN_RECORD_TYPES[number][] | undefined,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "success",
                  count: hits.length,
                  results: hits.map(summarize),
                  prompt_context: formatHitsForPrompt(hits),
                  _ai_instructions: [
                    "回答には必ず Golden Records の内容を引用し、[id=...] または URL を併記する",
                    "Golden Records に含まれない内容は「根拠がない」と明言する",
                    "validUntil が null でなく過去日の場合は「期限切れのため参考情報」と注記する",
                  ].join("\n"),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        console.error("search_golden_records エラー:", error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "error",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Golden Records 検索に失敗しました。",
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}

function summarize(hit: SearchHit): Record<string, unknown> {
  const r = hit.record;
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    summary: r.summary,
    source: r.source,
    citations: r.citations,
    valid_from: r.validFrom,
    valid_until: r.validUntil,
    version: r.version,
    score: Number(hit.score.toFixed(6)),
    ranks: hit.ranks,
  };
}
