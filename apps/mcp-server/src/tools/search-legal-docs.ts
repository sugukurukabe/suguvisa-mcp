import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SearchServiceClient } from "@google-cloud/discoveryengine";
import { generateText, isVertexAIAvailable } from "../lib/vertex-ai.js";
import { createLogger } from "@suguvisa/core/logger";

const logger = createLogger({ service: "suguvisa-mcp-legal-search" });

// --- キャッシュ関連の設定 ---
interface CacheEntry {
  timestamp: number;
  data: LegalSearchToolResponse;
}
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

type GroundingLevel = "primary_source" | "model_fallback_unverified" | "builtin_fallback_unverified";

interface LegalSearchResult {
  title: string;
  snippet: string;
  link?: string;
  source?: string;
  confidence?: number;
}

interface LegalSearchPayload {
  status: "success" | "fallback";
  source: "vertex_ai_search" | "gemini_knowledge_base" | "builtin_knowledge";
  grounding_level: GroundingLevel;
  requires_primary_source_verification: boolean;
  query: string;
  results: LegalSearchResult[];
  summary?: string;
  message?: string;
  _ai_instructions: string;
}

interface LegalSearchToolResponse extends Record<string, unknown> {
  content: Array<{ type: "text"; text: string }>;
}

// --- タイムアウト用ユーティリティ ---
async function withTimeout<T>(promise: Promise<T>, ms: number, fallbackErrorMsg = 'Timeout'): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(fallbackErrorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildResponse(payload: LegalSearchPayload): LegalSearchToolResponse {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payload, null, 2),
    }],
  };
}

/**
 * 入管マニュアル等のRAG検索 (Vertex AI Search / Discovery Engine API)
 * DataStore未設定時は未検証 fallback として返し、最新法令を断定しない。
 */
export function registerSearchLegalDocs(server: McpServer) {
  server.tool(
    "suguvisa_legal_docs_search",
    "【法務文書検索】Vertex AI Searchによるセマンティック検索で、入管法令・告示・通達・参考様式・行政届出チェックリスト等を自然言語で横断検索。DataStore未設定時は未検証fallbackとして返し、最新法令は断定しません。 / Semantic search across official/legal documents using Vertex AI Search. Fallbacks are marked unverified and must not be treated as current law.",
    {
      query: z.string().describe("検索クエリ（自然言語またはキーワード、例: 「特定技能1号 建設 分野の所属機関概要書の書き方」）"),
      max_results: z.number().optional().describe("最大結果件数（デフォルト: 5）"),
    },
    { title: "Search legal documents", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ query, max_results }) => {
      // === キャッシュの確認 ===
      const cacheKey = `${query}_${max_results || 5}`;
      const cached = searchCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
      }

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

          // Vertex AI Search は最大8秒でタイムアウト
          const [searchResults] = await withTimeout(client.search(request), 8000, "Vertex AI Search timeout after 8000ms");
          const results = searchResults.map((res: unknown) => {
            const result = res as {
              document?: {
                name?: string;
                structData?: { fields?: Record<string, { stringValue?: string }> };
                derivedStructData?: {
                  fields?: {
                    snippets?: {
                      listValue?: {
                        values?: Array<{
                          structData?: { fields?: { snippet?: { stringValue?: string } } };
                        }>;
                      };
                    };
                  };
                };
              };
            };
            const doc = result.document;
            const structData = doc?.structData?.fields;
            const title = structData?.title?.stringValue || doc?.name || "No Title";
            const extSnippet = doc?.derivedStructData?.fields?.snippets?.listValue?.values?.[0]?.structData?.fields?.snippet?.stringValue || "";
            
            return {
              title,
              snippet: extSnippet,
              link: doc?.structData?.fields?.link?.stringValue || doc?.name || "",
            };
          });

          const responseData = buildResponse({
            status: "success",
            source: "vertex_ai_search",
            grounding_level: "primary_source",
            requires_primary_source_verification: false,
            query,
            results: results || [],
            _ai_instructions:
              "Vertex AI Search の一次情報検索結果です。回答では link/source を引用し、検索結果にない最新法令・期限・必要書類は推測しないでください。",
          });
          
          searchCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
          return responseData;
        } catch (error: unknown) {
          logger.warn({ error: getErrorMessage(error) }, "Vertex AI Search failed; fallback will be marked unverified");
          // フォールバック: Gemini
        }
      }

      // === Stage 2: Gemini AIベースの法務知識フォールバック ===
      if (isVertexAIAvailable()) {
        try {
          // Gemini は最大7秒でタイムアウト
          const answer = await withTimeout(searchWithGemini(query, max_results || 5), 7000, "Gemini search timeout after 7000ms");
          const responseData = {
            content: [{
              type: "text" as const,
              text: JSON.stringify(answer, null, 2),
            }],
          };
          
          searchCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
          return responseData;
        } catch (err: unknown) {
          logger.warn({ error: getErrorMessage(err) }, "Gemini legal-search fallback failed");
        }
      }

      // === Stage 3: 組み込み知識ベース（最終フォールバック）===
      const responseData = buildResponse({
        status: "fallback",
        source: "builtin_knowledge",
        grounding_level: "builtin_fallback_unverified",
        requires_primary_source_verification: true,
        query,
        message: "Vertex AI Search / Gemini が利用できません（またはタイムアウト）。組み込みの基本知識から未検証の参考情報だけを返します。",
        results: getBuiltinResults(query),
        _ai_instructions:
          "これは一次情報にgroundedされていない未検証fallbackです。最新法令・期限・必要書類を断定せず、入管庁HP・公式様式・行政書士/弁護士確認を促してください。モデル自身の知識で補完して断定してはいけません。",
      });
      
      // 組み込みの結果も一応キャッシュしておく
      searchCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
      return responseData;
    }
  );
}

// === Gemini AIによるナレッジベース検索 ===
async function searchWithGemini(query: string, maxResults: number): Promise<LegalSearchPayload> {
  const prompt = `あなたは日本の特定技能ビザ制度に精通した入管法の専門家です。

以下の質問に対して、未検証の参考回答であることが分かる形で回答してください。最新法令・期限・必要書類の断定は避けてください。

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
  "summary": "質問への簡潔な参考回答（300文字以内）。最新法令の断定は避ける"
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
      status: "fallback",
      source: "gemini_knowledge_base",
      grounding_level: "model_fallback_unverified",
      requires_primary_source_verification: true,
      query,
      results: parsed.results || [],
      summary: parsed.summary || "",
      _ai_instructions:
        "Gemini AIの未検証fallbackです。一次情報検索ではありません。最新法令・期限・必要書類を断定せず、入管庁HP、公式様式、Vertex Search結果、行政書士/弁護士確認を必ず促してください。",
    };
  }
  
  throw new Error("Gemini did not return valid JSON");
}

// === 組み込みナレッジベース（最終フォールバック）===
function getBuiltinResults(query: string): LegalSearchResult[] {
  const knowledge = [
    {
      keywords: ["14日", "届出", "随時"],
      title: "随時届出の14日ルール",
      snippet: "特定技能所属機関は、受入れ外国人の雇用契約変更・終了・新規雇用・転職等の事由が発生した場合、14日以内に出入国在留管理庁へ届出が必要です（入管法第19条の18）。届出を怠ると30万円以下の罰金の対象となります。",
      link: ""
    },
    {
      keywords: ["最低賃金", "時給", "給与"],
      title: "最低賃金との関係",
      snippet: "特定技能外国人の報酬は、同等の業務に従事する日本人と同等以上でなければなりません。また、都道府県ごとの最低賃金を下回ることはできません。2025年度の全国加重平均最低賃金は1,055円です。",
      link: ""
    },
    {
      keywords: ["試験", "免除", "技能実習", "移行"],
      title: "技能実習からの移行時の試験免除",
      snippet: "技能実習2号を良好に修了した場合、同一の業務区分への移行であれば技能試験と日本語試験（N4相当）の両方が免除されます。異なる分野への移行の場合は技能試験の合格が必要です。",
      link: ""
    },
    {
      keywords: ["派遣", "農業", "漁業"],
      title: "派遣形態が認められる分野",
      snippet: "特定技能1号で派遣形態が認められているのは農業と漁業の2分野のみです（令和元年法務省令第7号）。これらの分野では、季節的な労働需要の変動に対応するため、派遣元が労働者派遣事業の許可を得ていることを条件に派遣が認められています。",
      link: ""
    },
    {
      keywords: ["特定活動", "つなぎ", "ビザ"],
      title: "特定活動（つなぎビザ）の要件",
      snippet: "特定技能1号の申請準備中に在留期限が切れる場合、「特定活動」への変更が認められることがあります。就労は前の雇用主のもとでのみ可能で、新しい雇用主のもとでの就労は認められません。通常4ヶ月が付与されます。",
      link: ""
    },
    {
      keywords: ["オンライン", "申請", "マイナンバー"],
      title: "オンライン申請の手続き",
      snippet: "在留資格のオンライン申請は、出入国在留管理庁の電子届出システムから行えます。弁護士・行政書士等の申請取次者が利用する場合は、事前に利用者登録が必要です。一括申請も可能で、CSV/Excelでのデータアップロードに対応しています。",
      link: ""
    },
  ];

  const lower = query.toLowerCase();
  const matched = knowledge.filter(k => 
    k.keywords.some(kw => lower.includes(kw))
  );

  return matched.length > 0 ? matched : knowledge.slice(0, 3);
}
