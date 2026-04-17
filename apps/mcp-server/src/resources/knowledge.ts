/**
 * 法改正 / 期限ルール / 申請中就労ルール等の「知識データ」
 * Knowledge resources: law updates, deadline rules, work-during-application rules
 * Resource pengetahuan: pembaruan hukum, aturan tenggat, aturan kerja selama permohonan
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResource, loadJson } from "./util.js";

export function registerKnowledgeResources(server: McpServer): void {
  server.registerResource(
    "law_updates_latest",
    "suguvisa://law-updates/latest",
    {
      title: "法改正・制度変更情報",
      description:
        "特定技能制度に関する最新の法改正・制度変更・運用要領改定の一覧。施行済み・施行準備中のステータス付き。",
      mimeType: "application/json",
    },
    async () => {
      const lawUpdates = loadJson("law-updates.json");
      return jsonResource("suguvisa://law-updates/latest", lawUpdates);
    },
  );

  server.registerResource(
    "deadline_rules",
    "suguvisa://deadlines/rules",
    {
      title: "期限計算ルール一覧",
      description:
        "随時届出14日ルール、更新申請3ヶ月前開始、通算在留5年上限、認定証明書3ヶ月有効期限など、SuguVisa が期限計算に使用する全ルールの定義。",
      mimeType: "application/json",
    },
    async () => {
      const rules = {
        deadline_rules: [
          {
            id: "notification_14day",
            name: "随時届出の14日ルール",
            description: "届出事由の発生日から14日以内に届出が必要",
            calculation: "event_date + 14 calendar days",
            risk_levels: {
              green: "7日以上の余裕",
              yellow: "3〜6日の余裕",
              red: "2日以内 or 期限超過",
            },
            legal_basis: "入管法第19条の16",
          },
          {
            id: "renewal_3month",
            name: "更新申請の開始可能日",
            description: "在留期限の3ヶ月前から更新申請が可能",
            calculation: "expiry_date - 3 months",
            recommended: "在留期限の2〜3ヶ月前に申請開始を推奨",
          },
          {
            id: "ssw1_5year_cap",
            name: "特定技能1号の通算在留上限",
            description: "特定技能1号の通算在留期間は上限5年（60ヶ月）",
            calculation: "ssw1_start_date + 5 years",
            note: "上限到達前に特定技能2号への移行を検討",
          },
          {
            id: "coe_validity",
            name: "認定証明書の有効期限",
            description: "在留資格認定証明書は交付日から3ヶ月以内に入国が必要",
            calculation: "coe_issue_date + 3 months",
          },
          {
            id: "annual_report",
            name: "定期届出の提出期間",
            description: "毎年4月1日〜5月31日に年1回の定期届出を提出",
            fixed_period: "4/1 〜 5/31",
            legal_basis: "2025年4月改正",
          },
        ],
      };
      return jsonResource("suguvisa://deadlines/rules", rules);
    },
  );

  server.registerResource(
    "work_during_application_rules",
    "suguvisa://rules/work-during-application",
    {
      title: "申請中の就労ルール",
      description:
        "在留資格変更許可申請中の就労可否ルール。「新しい雇用主のもとでは就労不可」「前の雇用主では就労可能」等の重要な注意事項。",
      mimeType: "application/json",
    },
    async () => {
      const ruleSets = loadJson<{ work_during_application: unknown }>("rule-sets.json");
      return jsonResource(
        "suguvisa://rules/work-during-application",
        ruleSets.work_during_application,
      );
    },
  );

  server.registerResource(
    "rule_sets_version",
    "suguvisa://rules/version",
    {
      title: "ルールセットのバージョン",
      description:
        "SuguVisa が搭載しているビザ判定ルールセットのバージョン・最終更新者。AI は回答の前にここを参照し、必要に応じて「○年○月版のルールに基づく回答」と明記するのが望ましい。",
      mimeType: "application/json",
    },
    async () => {
      const ruleSets = loadJson<{ version?: string; last_updated_by?: string }>("rule-sets.json");
      return jsonResource("suguvisa://rules/version", {
        version: ruleSets.version,
        last_updated_by: ruleSets.last_updated_by,
      });
    },
  );
}
