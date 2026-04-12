import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SearchServiceClient } from "@google-cloud/discoveryengine";

/**
 * 入管マニュアル等のRAG検索 (Vertex AI Search / Discovery Engine API)
 * Search legal documents using Vertex AI Search.
 */
export function registerSearchLegalDocs(server: McpServer) {
  server.tool(
    "search_legal_docs",
    "【法務文書検索】Vertex AI Searchによるセマンティック検索で、法務マニュアル・契約書テンプレート・行政届出チェックリスト・SuguVisaマニュアル等を自然言語で横断検索。「特定技能1号 建設 所属機関概要書の書き方」のような質問でも関連文書を返す。 / Semantic search across legal documents, contract templates, and administrative checklists using Vertex AI Search.",
    {
      query: z.string().describe("検索クエリ（自然言語またはキーワード、例: 「特定技能1号 建設 分野の所属機関概要書の書き方」）"),
      max_results: z.number().optional().describe("最大結果件数（デフォルト: 5）"),
    },
    async ({ query, max_results }) => {
      const projectId = process.env.VERTEX_SEARCH_PROJECT_ID || process.env.GCP_PROJECT_ID;
      const location = process.env.VERTEX_SEARCH_LOCATION || "global";
      const dataStoreId = process.env.VERTEX_SEARCH_DATA_STORE_ID;

      if (!projectId || !dataStoreId) {
        // フォールバック/モック動作（GCPの設定がない場合）
        // ユーザーがすぐに使えるように、システムがモックの検索結果を返す。
        console.warn("[search_legal_docs] Vertex AI Search credentials omitted. Running in MOCK mode.");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "mock_success",
                message: "🚧 Vertex AI Search (Discovery Engine) の設定がありません（.envに PROJECT_ID や DATA_STORE_ID が未設定）。以下はモックの検索結果です。",
                results: [
                  {
                    title: "一括登録用Excelツール マニュアル",
                    snippet: "【分野: 農業】 派遣形態の場合、区分Vシートの「派遣先企業名」は必須となります。就業場所が複数ある場合は最も就労時間の長い場所を一つ記載してください。また、直接雇用の場合は同欄は空欄とする必要があります...",
                    link: "mock:///manuals/excel-manual.pdf#page=12",
                  },
                  {
                    title: "特定技能1号（農業）提出書類チェックリスト",
                    snippet: "特定技能1号（農業分野）における派遣契約では、「労働者派遣基本契約書」および「個別契約書」に加えて、農業分野特有の「派遣先概要書」を添付し、時給計算が最低賃金を上回っていることを示す必要があります。",
                    link: "mock:///checklists/agri-dispatch.pdf#page=2",
                  }
                ]
              }, null, 2)
            }
          ]
        };
      }

      try {
        const client = new SearchServiceClient();
        
        const servingConfig = `projects/${projectId}/locations/${location}/collections/default_collection/dataStores/${dataStoreId}/servingConfigs/default_search`;

        const request = {
          servingConfig,
          query,
          pageSize: max_results || 5,
        };

        const [searchResults] = await client.search(request);
        const results = searchResults.map((res: any) => {
          // Discovery Engine APIからスニペット、タイトル等を抽出
          const doc = res.document;
          const structData = doc?.structData?.fields;
          const title = structData?.title?.stringValue || doc?.name || "No Title";
          const extSnippet = res.document?.derivedStructData?.fields?.snippets?.listValue?.values?.[0]?.structData?.fields?.snippet?.stringValue || "";
          
          return {
            title,
            snippet: extSnippet,
            link: doc?.structData?.fields?.link?.stringValue || doc?.name || "",
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              query,
              results: results || [],
            }, null, 2)
          }]
        };
      } catch (error: any) {
        console.error("Vertex AI Search execution failed:", error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "通信エラー、または GCP Search の実行に失敗しました。",
              details: error.message,
            }, null, 2)
          }]
        };
      }
    }
  );
}
