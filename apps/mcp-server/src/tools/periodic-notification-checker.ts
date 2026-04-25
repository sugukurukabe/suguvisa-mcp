import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPeriodicNotificationChecker(server: McpServer) {
  server.tool(
    "suguvisa_periodic_notification_requirements_check",
    "【定期届出】受入れ機関（企業）の属性データに基づき、定期届出（受入れ・活動・支援実施状況に係る届出等）に必要な書類リストを判定して出力するツール。 / Determine required documents for the SSW Periodic Notification based on the company's attributes such as delegation status to a Registered Support Organization.",
    {
      company_name: z.string().describe("対象企業の名称"),
      is_delegated: z.boolean().describe("支援業務の全部を登録支援機関に委託しているか（true: 委託済, false: 自社支援）"),
      has_good_standing: z.boolean().describe("優良要件（過去の受入れ等に基づく免除規定）を満たしているか"),
      has_middle_resignation: z.boolean().optional().describe("届出対象期間中に中途退職者が発生したか"),
      has_rest_period: z.boolean().optional().describe("届出対象期間中に休業が発生したか"),
    },
    { title: "Check periodic notification requirements", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ company_name, is_delegated, has_good_standing, has_middle_resignation, has_rest_period }) => {
      
      const required_documents = [
        {
          id: "doc-1",
          name: "受入れ・活動・支援実施状況に係る届出書（参考様式第3-6号）",
          description: "特定技能外国人の受入れ状況及び活動状況、並びに支援の実施状況を包括して届け出る書面",
          required: true
        }
      ];

      // 支援を登録支援機関に委託していない場合（自社支援）は追加書類が必要
      if (!is_delegated) {
        required_documents.push({
          id: "doc-2",
          name: "支援実施状況に係る届出書（参考様式第3-7号）の添付書類（面談記録など）",
          description: "自社で支援を実施している場合は、定期面談の記録簿などの証拠書類の添付が必要です。",
          required: true
        });
      }

      // 賃金台帳・出勤簿等は、優良要件がなく自社支援の場合等に求められることが多い。最新審査基準では原則提出を求めるケースもあるため含める
      if (!has_good_standing) {
        required_documents.push({
          id: "doc-3",
          name: "対象外国人の賃金台帳の写し",
          description: "全対象期間分の給与や控除が確認できるもの",
          required: true
        });
        required_documents.push({
          id: "doc-4",
          name: "出勤簿（タイムカード等）の写し",
          description: "対象期間における労働時間・残業時間のわかるもの",
          required: true
        });
      }

      // エッジケースの書類
      if (has_middle_resignation) {
        required_documents.push({
          id: "doc-5",
          name: "中途退職に関する説明書・届出書控",
          description: "中途退職者がいる場合は、事前に「受入れ困難に係る届出」等が出されているか確認し、その写し等が必要になります。",
          required: true
        });
      }

      if (has_rest_period) {
        required_documents.push({
          id: "doc-6",
          name: "休業状況に関する説明書（理由書）",
          description: "外国人を休業させた実績がある場合、休業手当が適切に支払われているか確認できる資料の添付が必要になります。",
          required: true
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              target_company: company_name,
              notification_period: "毎年4月1日〜5月31日",
              documents: required_documents,
              _ai_instructions: "このリストをもとにして、ユーザーへ準備すべき書類の一覧を案内してください。また、収集済みの賃金台帳や出勤簿があれば、suguvisa_support_records_analyze ツールを使ってAI監査を行うよう促してください。"
            }, null, 2)
          }
        ]
      };
    }
  );
}
