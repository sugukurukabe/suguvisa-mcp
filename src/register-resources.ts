/**
 * MCP Resources — SuguVisa の知識データを AI が直接参照できるリソースとして公開。
 *
 * Resources は「AIが事前に読める静的データ」。Tools を呼ぶ前に
 * パターン一覧や産業分野を把握できるため、ツール呼び出しの精度が劇的に向上する。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(filename: string): any {
  const filePath = path.resolve(__dirname, "data", filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function registerAllResources(server: McpServer): void {
  // ─── 1. 申請パターン一覧 ───
  server.resource(
    "全申請パターン一覧",
    "suguvisa://patterns/list",
    {
      description:
        "特定技能ビザの全申請パターン（変更・更新・認定・転職等）のID・正式名称・処理期間を一覧で取得。" +
        "determine_application_type を呼ぶ前に、どんなパターンが存在するか確認できます。",
      mimeType: "application/json",
    },
    async () => {
      const ruleSets = loadJson("rule-sets.json");
      const patterns = Object.values(ruleSets.application_patterns as Record<string, any>).map(
        (p: any) => ({
          id: p.id,
          formal_name: p.formal_name,
          short_name: p.short_name,
          from_visa: p.from_visa,
          to_visa: p.to_visa,
          description: p.description,
          typical_processing_days: p.typical_processing_days,
        })
      );
      return {
        contents: [{
          uri: "suguvisa://patterns/list",
          mimeType: "application/json",
          text: JSON.stringify({ total: patterns.length, patterns }, null, 2),
        }],
      };
    }
  );

  // ─── 2. 特定産業分野一覧（16分野） ───
  server.resource(
    "特定産業分野一覧（16分野）",
    "suguvisa://industries/list",
    {
      description:
        "特定技能1号の対象16産業分野のコード・試験情報・派遣可否を一覧で取得。" +
        "分野ごとの技能試験名・実施機関・分野固有書類も含みます。",
      mimeType: "application/json",
    },
    async () => {
      const fieldSpecific = loadJson("field-specific.json");
      const industries = Object.entries(fieldSpecific.fields as Record<string, any>).map(
        ([name, data]: [string, any]) => ({
          name,
          code: data.code,
          industry_code: data.industry_code,
          skill_test_name: data.skill_test?.name,
          skill_test_organizer: data.skill_test?.organizer,
          dispatch_allowed: data.dispatch_allowed ?? false,
          additional_documents_count: data.additional_documents?.length ?? 0,
        })
      );
      return {
        contents: [{
          uri: "suguvisa://industries/list",
          mimeType: "application/json",
          text: JSON.stringify({ total: industries.length, industries }, null, 2),
        }],
      };
    }
  );

  // ─── 3. 最新の法改正情報 ───
  server.resource(
    "法改正・制度変更情報",
    "suguvisa://law-updates/latest",
    {
      description:
        "特定技能制度に関する最新の法改正・制度変更・運用要領改定の一覧。" +
        "施行済み・施行準備中のステータス付き。get_law_updates ツールのソースデータ。",
      mimeType: "application/json",
    },
    async () => {
      const lawUpdates = loadJson("law-updates.json");
      return {
        contents: [{
          uri: "suguvisa://law-updates/latest",
          mimeType: "application/json",
          text: JSON.stringify(lawUpdates, null, 2),
        }],
      };
    }
  );

  // ─── 4. 参考様式一覧 ───
  server.resource(
    "参考様式一覧（申請書類テンプレート）",
    "suguvisa://forms/list",
    {
      description:
        "出入国在留管理庁が公開している特定技能関連の参考様式（申請書類テンプレート）の一覧。" +
        "様式番号・名称・カテゴリ・記入者・バイリンガル対応状況を含みます。",
      mimeType: "application/json",
    },
    async () => {
      const refForms = loadJson("reference-forms.json");
      const forms = Object.entries(refForms.forms as Record<string, any>).map(
        ([key, data]: [string, any]) => ({
          key,
          number: data.number,
          name: data.name,
          category: data.category,
          who: data.who,
          bilingual: data.bilingual,
          bilingual_languages: data.bilingual_languages,
        })
      );
      return {
        contents: [{
          uri: "suguvisa://forms/list",
          mimeType: "application/json",
          text: JSON.stringify({ total: forms.length, source_url: refForms.source_url, forms }, null, 2),
        }],
      };
    }
  );

  // ─── 5. 期限計算ルール一覧 ───
  server.resource(
    "期限計算ルール一覧",
    "suguvisa://deadlines/rules",
    {
      description:
        "随時届出14日ルール、更新申請3ヶ月前開始、通算在留5年上限、認定証明書3ヶ月有効期限など、" +
        "SuguVisa が期限計算に使用する全ルールの定義。calculate_deadlines の判断基準。",
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
            risk_levels: { green: "7日以上の余裕", yellow: "3〜6日の余裕", red: "2日以内 or 期限超過" },
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
      return {
        contents: [{
          uri: "suguvisa://deadlines/rules",
          mimeType: "application/json",
          text: JSON.stringify(rules, null, 2),
        }],
      };
    }
  );

  // ─── 6. 申請中の就労ルール ───
  server.resource(
    "申請中の就労ルール",
    "suguvisa://rules/work-during-application",
    {
      description:
        "在留資格変更許可申請中の就労可否ルール。" +
        "「新しい雇用主のもとでは就労不可」「前の雇用主では就労可能」等の重要な注意事項。",
      mimeType: "application/json",
    },
    async () => {
      const ruleSets = loadJson("rule-sets.json");
      return {
        contents: [{
          uri: "suguvisa://rules/work-during-application",
          mimeType: "application/json",
          text: JSON.stringify(ruleSets.work_during_application, null, 2),
        }],
      };
    }
  );
}
