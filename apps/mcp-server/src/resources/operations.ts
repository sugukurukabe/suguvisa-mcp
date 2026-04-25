/**
 * 運用・コンプライアンス系リソース
 * Operational and compliance MCP resources
 * Resource MCP untuk operasional dan kepatuhan
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResource, markdownResource } from "./util.js";

const SERVER_VERSION = "0.9.4";

export function registerOperationResources(server: McpServer): void {
  server.registerResource(
    "server_info",
    "suguvisa://server/info",
    {
      title: "SuguVisa MCP サーバー情報",
      description:
        "稼働中の MCP サーバーのバージョン・機能・エンドポイント・認証方式のメタ情報。AI が回答前に自己紹介する際の根拠資料。",
      mimeType: "application/json",
    },
    async () => {
      return jsonResource("suguvisa://server/info", {
        name: "suguvisa-mcp",
        version: SERVER_VERSION,
        vendor: "Sugukuru Inc.",
        description:
          "日本の特定技能ビザ申請を自動化する MCP サーバー。行政書士・登録支援機関・受入れ機関向け。",
        endpoints: {
          mcp: "/mcp",
          rest: "/api/v1/tools/*",
          tenant: "/api/v1/tenant/*",
          health: "/health",
          oauth_prm: "/.well-known/oauth-protected-resource",
        },
        features: {
          oauth21: true,
          legacy_api_key: true,
          rate_limiting: true,
          pii_redaction: true,
          observability: "OpenTelemetry + Langfuse (optional)",
          knowledge_base: "Golden Records (BM25 + Vector hybrid)",
        },
        supported_clients: ["Claude.ai", "ChatGPT", "Cursor", "Windsurf"],
      });
    },
  );

  server.registerResource(
    "server_slo",
    "suguvisa://server/slo",
    {
      title: "SuguVisa SLO / 運用コミットメント",
      description:
        "可用性・レイテンシ・サポート対応時間などの SLO と、プラン別サポート SLA を記述。営業・ユーザー向けの透明性資料。",
      mimeType: "application/json",
    },
    async () => {
      return jsonResource("suguvisa://server/slo", {
        availability: {
          target: "99.5% (monthly)",
          measurement: "Cloud Run health check + external uptime monitoring",
        },
        latency: {
          p50_target_ms: 500,
          p95_target_ms: 2000,
          note: "LLM を使用するツール (AI review, reason letter など) は別指標で測定",
        },
        support: {
          Free: "コミュニティ (GitHub Issues)",
          Standard: "メール - 営業日 24h 以内",
          Enterprise: "メール + Slack Connect - 営業日 4h 以内",
        },
        incident_response: {
          notification: "Slack #30-dev および Status Page",
          postmortem: "P1 は 5 営業日以内に公開",
        },
        compliance: {
          personal_info_protection: "個人情報保護法 (日本)",
          data_residency: "Cloud Run asia-northeast1 (東京)",
          pii_handling: "suguvisa://compliance/pii を参照",
        },
        last_updated: "2026-04-01",
      });
    },
  );

  server.registerResource(
    "changelog",
    "suguvisa://server/changelog",
    {
      title: "SuguVisa MCP 変更履歴",
      description:
        "MCP サーバーの主要な機能追加・仕様変更・破壊的変更をリストアップ。AI クライアントが最新機能を把握する際の根拠資料。",
      mimeType: "application/json",
    },
    async () => {
      return jsonResource("suguvisa://server/changelog", {
        version: SERVER_VERSION,
        entries: [
          {
            version: "0.10.0 (Phase 2)",
            date: "2026-04",
            changes: [
              "Resource Templates (URI テンプレート) 対応",
              "Golden Records ハイブリッド検索 (BM25 + Vector)",
              "OpenTelemetry + Langfuse observability",
              "MCP Prompts を 14 種類に拡張",
            ],
          },
          {
            version: "0.9.x (Phase 1)",
            date: "2026-02 〜 03",
            changes: [
              "OAuth 2.1 Resource Server (Auth0)",
              "PII マスキング + 監査ログ",
              "レート制限 (IP / tenant / plan 3 層) + Cloud Armor",
              "Monorepo 化 (pnpm workspace + Turborepo)",
            ],
          },
          {
            version: "0.8.x",
            date: "2026-01",
            changes: ["定期届出ツール群", "HITL 対応の自律ワークフロー"],
          },
        ],
      });
    },
  );

  server.registerResource(
    "pii_policy",
    "suguvisa://compliance/pii",
    {
      title: "PII 取扱いポリシー",
      description:
        "SuguVisa が在留カード番号・氏名・住所等の PII をどう扱うかのポリシー。AI の回答や UI 表示においてユーザーへ透明性を提供するために使用。",
      mimeType: "text/markdown",
    },
    async () => {
      const md = `# PII 取扱いポリシー / PII Handling Policy

## 基本方針
- 在留カード番号・パスポート番号・氏名・住所・電話番号・メール等の個人情報は **最小化** を原則とする。
- これらを含む値は \`Pii<T>\` ラッパで保持し、**誤って JSON 化・文字列化しても自動でマスキング** される。
- \`.unmask(auditContext)\` による平文取得は **監査ログに必ず記録** される (principal, purpose, reason, resource)。
- ログ・メトリクス・トレースには **PII を流さない** (pino redaction + observability sanitizeArgs)。

## ストレージ
- Supabase / Firestore では、PII カラムは Cloud KMS による envelope 暗号化を前提 (Phase 3 で本番運用予定)。
- データ所在地は Cloud Run / Supabase とも \`asia-northeast1\`。

## AI / LLM への流入
- LLM に渡す前に、観測可能な部分は マスク済み Pii に変換する。
- Langfuse には **マスク済みの要約のみ** を送信。

## 関連リソース
- 詳細設計: \`docs/security/pii-handling.md\`
- 契約: \`PRIVACY.md\`
`;
      return markdownResource("suguvisa://compliance/pii", md);
    },
  );
}
