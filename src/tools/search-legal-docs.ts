import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SearchServiceClient } from "@google-cloud/discoveryengine";
import { generateText, isVertexAIAvailable } from "../lib/vertex-ai.js";

/**
 * 入管マニュアル等のRAG検索 (Vertex AI Search / Discovery Engine API)
 * DataStore未設定時は Gemini による法務知識ベースでフォールバック
 */
export function registerSearchLegalDocs(server: McpServer) {
  server.tool(
    "search_legal_docs",
    "【法務文書検索】Vertex AI Searchによるセマンティック検索で、法務マニュアル・契約書テンプレート・行政届出チェックリスト・SuguVisaマニュアル等を自然言語で横断検索。DataStore未設定時はGemini AIが法務知識ベースから直接回答。「特定技能1号 建設 所属機関概要書の書き方」のような質問でも回答可能。 / Semantic search across legal documents using Vertex AI Search, with Gemini AI knowledge base fallback.",
    {
      query: z.string().describe("検索クエリ（自然言語またはキーワード、例: 「特定技能1号 建設 分野の所属機関概要書の書き方」）"),
      max_results: z.number().optional().describe("最大結果件数（デフォルト: 5）"),
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ query, max_results }) => {
      const projectId = process.env.VERTEX_SEARCH_PROJECT_ID || process.env.GCP_PROJECT_ID;
      const location = process.env.VERTEX_SEARCH_LOCATION || "global";
      const dataStoreId = process.env.VERTEX_SEARCH_DATA_STORE_ID;

      // === Stage 1: Vertex AI Search (DataStore設定済みの場合) ===
      if (projectId && dataStoreId) {
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
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                source: "vertex_ai_search",
                query,
                results: results || [],
              }, null, 2),
            }],
          };
        } catch (error: any) {
          console.error("Vertex AI Search failed, falling back to Gemini:", error.message);
          // フォールバック: Gemini
        }
      }

      // === Stage 2: Gemini AIベースの法務知識フォールバック ===
      if (isVertexAIAvailable()) {
        try {
          const answer = await searchWithGemini(query, max_results || 5);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(answer, null, 2),
            }],
          };
        } catch (err: any) {
          console.error("Gemini search fallback failed:", err.message);
        }
      }

      // === Stage 3: 組み込み知識ベース（最終フォールバック）===
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "fallback",
            source: "builtin_knowledge",
            query,
            message: "Vertex AI Search / Gemini が利用できません。組み込みの基本知識から回答します。",
            results: getBuiltinResults(query),
            _ai_instructions: "検索結果が限定的です。ユーザーの質問に対してあなた自身の入管法の知識で補完してください。",
          }, null, 2),
        }],
      };
    }
  );
}

// === Gemini AIによるナレッジベース検索 ===
async function searchWithGemini(query: string, maxResults: number) {
  const prompt = `あなたは日本の特定技能ビザ制度に精通した入管法の専門家です。

以下の質問に対して、正確な法令知識に基づいて回答してください。

質問: ${query}

以下のJSON形式で回答してください。結果は${maxResults}件以内でお願いします:
{
  "results": [
    {
      "title": "回答のトピック/関連法令",
      "snippet": "具体的な回答（200文字以内）",
      "source": "根拠法令・通達等（例: 入管法第19条の16、技能実習法施行規則）",
      "confidence": 0.0-1.0の確信度
    }
  ],
  "summary": "質問への簡潔な総合回答（300文字以内）"
}

重要な知識領域:
- 特定技能1号・2号の制度（11分野→16分野への拡大含む）
- 在留資格変更・更新の手続き
- 技能実習からの移行要件（試験免除条件）
- 随時届出（14日ルール）と定期届出
- 派遣形態の特例（農業・漁業のみ）
- 登録支援機関の義務
- 最低賃金との関係
- 特定活動（つなぎビザ）の要件
- 在留カードの読み方
- オンライン申請の手続き

JSONのみを出力してください。`;

  const response = await generateText(prompt, false);
  
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      status: "success",
      source: "gemini_knowledge_base",
      query,
      results: parsed.results || [],
      summary: parsed.summary || "",
      _ai_instructions: "Gemini AIの法務知識による回答です。正確性は高いですが、最新の法改正が反映されていない可能性があります。重要な判断は入管庁HPまたは行政書士に確認してください。",
    };
  }
  
  throw new Error("Gemini did not return valid JSON");
}

// === 組み込みナレッジベース（最終フォールバック）===
function getBuiltinResults(query: string): Array<{title: string, snippet: string}> {
  const knowledge = [
    {
      keywords: ["14日", "届出", "随時"],
      title: "随時届出の14日ルール",
      snippet: "特定技能所属機関は、受入れ外国人の雇用契約変更・終了・新規雇用・転職等の事由が発生した場合、14日以内に出入国在留管理庁へ届出が必要です（入管法第19条の18）。届出を怠ると30万円以下の罰金の対象となります。",
    },
    {
      keywords: ["最低賃金", "時給", "給与"],
      title: "最低賃金との関係",
      snippet: "特定技能外国人の報酬は、同等の業務に従事する日本人と同等以上でなければなりません。また、都道府県ごとの最低賃金を下回ることはできません。2025年度の全国加重平均最低賃金は1,055円です。",
    },
    {
      keywords: ["試験", "免除", "技能実習", "移行"],
      title: "技能実習からの移行時の試験免除",
      snippet: "技能実習2号を良好に修了した場合、同一の業務区分への移行であれば技能試験と日本語試験（N4相当）の両方が免除されます。異なる分野への移行の場合は技能試験の合格が必要です。",
    },
    {
      keywords: ["派遣", "農業", "漁業"],
      title: "派遣形態が認められる分野",
      snippet: "特定技能1号で派遣形態が認められているのは農業と漁業の2分野のみです（令和元年法務省令第7号）。これらの分野では、季節的な労働需要の変動に対応するため、派遣元が労働者派遣事業の許可を得ていることを条件に派遣が認められています。",
    },
    {
      keywords: ["特定活動", "つなぎ", "ビザ"],
      title: "特定活動（つなぎビザ）の要件",
      snippet: "特定技能1号の申請準備中に在留期限が切れる場合、「特定活動」への変更が認められることがあります。就労は前の雇用主のもとでのみ可能で、新しい雇用主のもとでの就労は認められません。通常4ヶ月が付与されます。",
    },
    {
      keywords: ["オンライン", "申請", "マイナンバー"],
      title: "オンライン申請の手続き",
      snippet: "在留資格のオンライン申請は、出入国在留管理庁の電子届出システムから行えます。弁護士・行政書士等の申請取次者が利用する場合は、事前に利用者登録が必要です。一括申請も可能で、CSV/Excelでのデータアップロードに対応しています。",
    },
  ];

  const lower = query.toLowerCase();
  const matched = knowledge.filter(k => 
    k.keywords.some(kw => lower.includes(kw))
  );

  return matched.length > 0 ? matched : knowledge.slice(0, 3);
}
