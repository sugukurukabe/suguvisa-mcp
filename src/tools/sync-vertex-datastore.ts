import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DocumentServiceClient } from "@google-cloud/discoveryengine";

const client = new DocumentServiceClient();

/**
 * Vertex AI SearchのデータストアにGCSからドキュメントを一括インポートするツール
 */
export function registerSyncVertexDatastore(server: McpServer) {
  server.tool(
    "sync_vertex_datastore",
    "GCSバケット（例: gs://sugukuru-vertex-search/immigration-law/*）の入管法律関連ファイルをVertex AI Searchに同期・インポートし、最新の法務マニュアルとしてRAG検索可能にする / Import GCS documents to Vertex AI Search Data Store",
    {
      gcsUri: z.string().default("gs://sugukuru-vertex-search/immigration-law/*")
        .describe("インポート元のGCS URI"),
      dataStoreId: z.string().optional()
        .describe("DataStore ID (省略時は環境変数 VERTEX_SEARCH_DATA_STORE_ID を使用)"),
    },
    { destructiveHint: true }, // データ更新を伴うため
    async ({ gcsUri, dataStoreId }) => {
      try {
        const projectId = process.env.VERTEX_SEARCH_PROJECT_ID || process.env.GCP_PROJECT_ID;
        const location = process.env.VERTEX_SEARCH_LOCATION || "global";
        const actualDataStoreId = dataStoreId || process.env.VERTEX_SEARCH_DATA_STORE_ID;

        if (!projectId || !actualDataStoreId) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "error",
                        message: "VERTEX_SEARCH_PROJECT_ID or VERTEX_SEARCH_DATA_STORE_ID is missing in environment variables.",
                    }),
                }],
            };
        }

        const parent = `projects/${projectId}/locations/${location}/collections/default_collection/dataStores/${actualDataStoreId}/branches/default_branch`;

        const request = {
          parent,
          gcsSource: {
            inputUris: [gcsUri],
            dataSchema: "custom", // GCSの場合は自動判定が効く
          },
          reconciliationMode: "INCREMENTAL" as const, // 新規・更新分のみ同期
        };

        // Long Running Operation の開始
        const [operation] = await client.importDocuments(request);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: `Import operation started for ${gcsUri} into DataStore ${actualDataStoreId}. It may take a few minutes for the documents to become searchable.`,
              operationName: operation.name,
              _ai_instruction: "インポートが完了するまでしばらく時間がかかります。ユーザーにはバックグラウンドで学習中とお伝え下さい。"
            }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "error", message: error.message }),
          }],
        };
      }
    }
  );
}
