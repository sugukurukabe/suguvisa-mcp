/**
 * suguvisa_corporate_number_lookup — 国税庁 法人番号公表API連携
 *
 * 会社名から法人番号・本店所在地・代表者を自動取得。
 * ユーザーは会社名を入力するだけで、申請に必要な企業情報が揃う。
 *
 * API: https://www.houjin-bangou.nta.go.jp/webapi/
 * 無料 / 認証不要（アプリケーションID不要で基本検索可能）
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface CorporateInfo {
  corporate_number: string;
  name: string;
  name_kana: string | null;
  address: string;
  prefecture: string;
  city: string;
  street: string;
  kind: string;  // "101"=国の機関, "201"=地方公共団体, "301"=株式会社, "302"=有限会社 etc.
  change_date: string | null;
  close_date: string | null;  // 閉鎖日（null=現在有効）
}

/**
 * 国税庁 法人番号 公表サイト Web-API (v4)
 * https://www.houjin-bangou.nta.go.jp/webapi/
 *
 * Note: アプリケーションIDが必要。環境変数 NTA_APP_ID で設定。
 * 未設定の場合はフォールバックとしてチェックデジット検証のみ行う。
 */
async function searchCorporate(query: string, ntaAppId?: string): Promise<CorporateInfo[]> {
  if (!ntaAppId) {
    return []; // API ID not configured
  }

  const baseUrl = "https://api.houjin-bangou.nta.go.jp/4/name";
  const params = new URLSearchParams({
    id: ntaAppId,
    name: query,
    type: "12",  // JSON (Unicode)
    mode: "2",   // 前方一致
    kind: "04",  // 全て
    close: "1",  // 現存のみ
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`NTA API returned ${response.status}`);
  }

  const data = await response.json() as any;
  const corporations = data?.corporations || [];

  return corporations.map((corp: any) => ({
    corporate_number: corp.corporateNumber || "",
    name: corp.name || "",
    name_kana: corp.furigana || null,
    address: `${corp.prefectureName || ""}${corp.cityName || ""}${corp.streetNumber || ""}`,
    prefecture: corp.prefectureName || "",
    city: corp.cityName || "",
    street: corp.streetNumber || "",
    kind: corp.kind || "",
    change_date: corp.changeDate || null,
    close_date: corp.closeDate || null,
  }));
}

/**
 * 法人番号チェックデジット検証
 */
function validateCorporateNumber(corpNum: string): boolean {
  if (!/^\d{13}$/.test(corpNum)) return false;
  const digits = corpNum.split("").map(Number);
  const checkDigit = digits[0];
  let sum = 0;
  for (let i = 1; i < 13; i++) {
    const nthFromRight = 13 - i;
    const weight = (nthFromRight % 2 === 1) ? 1 : 2;
    sum += digits[i] * weight;
  }
  const remainder = sum % 9;
  const expected = remainder === 0 ? 0 : (9 - remainder);
  return checkDigit === expected;
}

const kindLabels: Record<string, string> = {
  "101": "国の機関",
  "201": "地方公共団体",
  "301": "株式会社",
  "302": "有限会社",
  "303": "合名会社",
  "304": "合資会社",
  "305": "合同会社",
  "399": "その他の設立登記法人",
  "401": "外国会社等",
  "499": "その他",
};

export function registerLookupCorporateNumber(server: McpServer) {
  server.tool(
    "suguvisa_corporate_number_lookup",
    "【法人番号検索】会社名から国税庁の法人番号公表APIで法人番号・本店所在地を自動取得。会社名を入力するだけで申請に必要な企業情報が揃います。法人番号を直接指定した場合はチェックデジット検証も実行。 / Looks up corporate number, headquarters address via National Tax Agency API. Enter company name to auto-fill corporate info for visa applications.",
    {
      query: z.string().describe(
        "検索する会社名（例: 'スグクル'）または法人番号（13桁数字）"
      ),
    },
    { title: "Lookup corporate number", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ query }) => {
      const trimmed = query.trim();

      // If it's a 13-digit number, validate directly
      if (/^\d{13}$/.test(trimmed)) {
        const valid = validateCorporateNumber(trimmed);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "validation",
              corporate_number: trimmed,
              valid,
              message: valid
                ? `✅ 法人番号 ${trimmed} のチェックデジットは正常です`
                : `❌ 法人番号 ${trimmed} のチェックデジットが不正です。番号を再確認してください`,
            }, null, 2),
          }],
        };
      }

      // Search by name via NTA API
      const ntaAppId = process.env.NTA_APP_ID;

      if (!ntaAppId) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "api_not_configured",
              message: "国税庁 法人番号 Web-API のアプリケーションIDが設定されていません（環境変数: NTA_APP_ID）。" +
                "https://www.houjin-bangou.nta.go.jp/webapi/ で無料取得できます。" +
                "APIなしでも法人番号を直接入力してチェックデジット検証は可能です。",
              fallback_suggestion: "法人番号がわかっている場合は13桁の数字を直接入力してください",
              manual_search_url: `https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNm=${encodeURIComponent(trimmed)}`,
            }, null, 2),
          }],
        };
      }

      try {
        const results = await searchCorporate(trimmed, ntaAppId);

        if (results.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "not_found",
                query: trimmed,
                message: `「${trimmed}」に一致する法人が見つかりません。正式名称や略称を変えて検索してください。`,
                manual_search_url: `https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNm=${encodeURIComponent(trimmed)}`,
              }, null, 2),
            }],
          };
        }

        const formatted = results.map((r: CorporateInfo) => ({
          corporate_number: r.corporate_number,
          name: r.name,
          name_kana: r.name_kana,
          address: r.address,
          kind: kindLabels[r.kind] || r.kind,
          status: r.close_date ? `閉鎖（${r.close_date}）` : "現存",
          check_digit_valid: validateCorporateNumber(r.corporate_number),
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "ok",
              query: trimmed,
              result_count: formatted.length,
              results: formatted,
              _ai_instructions:
                "見つかった法人を一覧で表示し、ユーザーに該当企業を選択してもらってください。\n" +
                "選択後は corporate_number と address を他のツール（suguvisa_reference_form_generate, suguvisa_online_csv_generate 等）に渡せます。",
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "error",
              message: `法人番号API呼び出しエラー: ${err.message}`,
              manual_search_url: `https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNm=${encodeURIComponent(trimmed)}`,
            }, null, 2),
          }],
        };
      }
    }
  );
}
