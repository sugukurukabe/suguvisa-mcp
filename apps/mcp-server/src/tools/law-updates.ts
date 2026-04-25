import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

interface LawUpdate {
  date: string;
  title: string;
  summary: string;
  impact_on_ssw1: string;
  status: string;
  source_url: string;
}

interface LawUpdatesData {
  version: string;
  disclaimer: string;
  updates: LawUpdate[];
}

const lawUpdatesData = require("../data/law-updates.json") as LawUpdatesData;

export function registerLawUpdates(server: McpServer) {
  server.tool(
    "suguvisa_law_updates_list",
    "【法改正情報】特定技能制度に関する最新の法改正・制度変更・運用要領の変更情報を取得。施行日、影響範囲、対応方法を含む。日付・キーワード・ステータスで絞り込み可能。 / Retrieves latest legal updates, regulatory changes, and operational guideline revisions for the Specified Skilled Worker system.",
    {
      since: z.string().optional().describe("この日付以降の更新を取得（YYYY-MM-DD） / Get updates since this date (YYYY-MM-DD) / Dapatkan pembaruan sejak tanggal ini (YYYY-MM-DD)"),
      keyword: z.string().optional().describe("キーワードで絞り込み / Filter by keyword / Saring berdasarkan kata kunci"),
      status: z.string().optional().describe("ステータスで絞り込み（'施行済み', '施行準備中'） / Filter by status (e.g. '施行済み', '施行準備中') / Saring berdasarkan status"),
    },
    { title: "Get law updates", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ since, keyword, status }) => {
      let updates = [...lawUpdatesData.updates];

      if (since) {
        const sinceDate = new Date(since);
        updates = updates.filter((u: LawUpdate) => new Date(u.date) >= sinceDate);
      }

      if (keyword) {
        const kw = keyword.toLowerCase();
        updates = updates.filter(
          (u: LawUpdate) =>
            u.title.toLowerCase().includes(kw) ||
            u.summary.toLowerCase().includes(kw) ||
            u.impact_on_ssw1.toLowerCase().includes(kw)
        );
      }

      if (status) {
        updates = updates.filter((u: LawUpdate) => u.status.includes(status));
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "ok",
            data_version: lawUpdatesData.version,
            count: updates.length,
            updates,
            disclaimer: lawUpdatesData.disclaimer,
            official_url: "https://www.moj.go.jp/isa/",
            _ai_instructions:
              "📰 法改正情報を以下の形式で提示してください：\n" +
              "1. 各更新を「## 📅 日付 — タイトル」の見出しで時系列に表示\n" +
              "2. 特定技能への影響（impact_on_ssw1）を > [!IMPORTANT] で強調\n" +
              "3. 施行済みは ✅、準備中は 🔄 のアイコンを付ける\n" +
              "4. source_url をリンクとして提示し、Official URL も footer に添える\n" +
              "5. disclaimer を最後に小さく表示する",
          }, null, 2),
        }],
      };
    }
  );
}
