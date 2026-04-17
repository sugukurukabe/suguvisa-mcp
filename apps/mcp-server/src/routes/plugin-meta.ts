/**
 * Plugin metadata routes — GPT / Claude 自動発見用。
 * /.well-known/ai-plugin.json, /openapi.yaml, /privacy を提供。
 */
import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

const router = Router();

// ─── GPT Plugin Manifest ───
router.get("/.well-known/ai-plugin.json", (_req: Request, res: Response) => {
  const baseUrl = process.env.SUGUVISA_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  res.json({
    schema_version: "v1",
    name_for_human: "SuguVisa — 特定技能ビザ申請AI",
    name_for_model: "suguvisa",
    description_for_human:
      "日本の特定技能（SSW）ビザ申請を完全サポート。申請パターンの自動判定、必要書類リスト（省略条件自動適用）、期限計算（14日届出ルール対応）、データ検証、定期報告CSV/Excel生成、法改正追跡を提供。行政書士・登録支援機関・受入れ機関・外国人本人向け。",
    description_for_model:
      "SuguVisa is the expert tool for Japanese Specified Skilled Worker (SSW/特定技能) visa applications. " +
      "ALWAYS follow this workflow: " +
      "(1) Ask the user about their current visa and what they want to do. " +
      "(2) Call 'determineApplicationType' with from_visa and to_visa to get the pattern_id. " +
      "(3) Use the pattern_id to call 'getRequiredDocuments' for the full document checklist. " +
      "(4) Call 'calculateDeadlines' with any dates the user provides (expiry_date, event_date, ssw1_start_date). " +
      "(5) If the user has data to verify, call 'validateApplicationData'. " +
      "(6) For annual reporting, use 'generateAnnualReportCsv' or 'generateAnnualReportExcel'. " +
      "(7) For legal updates, call 'getLawUpdates'. " +
      "IMPORTANT RULES: " +
      "- Always present results in a user-friendly, structured format with headings, checklists, and tables. " +
      "- Highlight urgent deadlines with warning emojis. " +
      "- Explain skipped documents (省略) and why they are exempt. " +
      "- Respond in the same language the user uses (Japanese, English, or Indonesian). " +
      "- Always remind users that this is not legal advice and to consult a licensed immigration lawyer for final decisions.",
    auth: {
      type: "service_http",
      authorization_type: "bearer",
      verification_tokens: {},
    },
    api: {
      type: "openapi",
      url: `${baseUrl}/openapi.yaml`,
    },
    logo_url: `${baseUrl}/logo.png`,
    contact_email: "a_kabe@sugu-kuru.co.jp",
    legal_info_url: `${baseUrl}/privacy`,
  });
});

// ─── OpenAPI Spec ───
router.get("/openapi.yaml", (_req: Request, res: Response) => {
  const specPath = path.resolve(process.cwd(), "public", "openapi.yaml");
  if (fs.existsSync(specPath)) {
    res.type("text/yaml").sendFile(specPath);
  } else {
    res.status(404).json({ error: "openapi.yaml not found" });
  }
});

// ─── MCP Server Card (Smithery Auto-Discovery) ───
router.get("/.well-known/mcp/server-card.json", (_req: Request, res: Response) => {
  res.json({
    serverInfo: {
      name: "suguvisa-mcp",
      version: "0.9.1",
      description: "特定技能ビザ申請を完全自動化するAIエージェントサーバー。24ツール搭載。"
    },
    authentication: {
      required: false,
      schemes: []
    },
    configSchema: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          title: "Subscription Plan",
          description: "Select your plan tier. free=5 basic tools, pro=all 24 tools, enterprise=audit logs & tenant mgmt",
          default: "free",
          enum: ["free", "pro", "enterprise"]
        },
        apiKey: {
          type: "string",
          title: "API Key (Enterprise only)",
          description: "API key for Enterprise plan. Not required for free/pro plans.",
          default: "",
          "x-from": { header: "x-suguvisa-api-key" }
        },
        gcpProjectId: {
          type: "string",
          title: "GCP Project ID (Optional)",
          description: "Google Cloud Project ID for residence card OCR and legal document search. Leave empty if not needed.",
          default: ""
        }
      },
      required: []
    }
  });
});

// ─── Privacy Policy ───
router.get("/privacy", (_req: Request, res: Response) => {
  res.type("text/html").send(`
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>SuguVisa Privacy Policy</title></head>
<body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:20px;">
<h1>SuguVisa プライバシーポリシー</h1>
<p>最終更新: 2026年4月</p>
<h2>1. 収集する情報</h2>
<p>SuguVisa プラグインは、ユーザーが入力したビザ申請関連データ（在留カード番号、氏名、在留資格等）を処理しますが、
これらのデータは一時的な処理のみに使用され、サーバー側に永続的に保存されることはありません（監査ログ機能を明示的に有効化した場合を除く）。</p>
<h2>2. データの利用目的</h2>
<p>入力データは、申請種別の判定、必要書類の特定、期限計算、データ検証にのみ使用されます。</p>
<h2>3. 第三者提供</h2>
<p>ユーザーデータを第三者に提供・販売することはありません。</p>
<h2>4. お問い合わせ</h2>
<p>スグクル株式会社: <a href="mailto:a_kabe@sugu-kuru.co.jp">a_kabe@sugu-kuru.co.jp</a></p>
</body>
</html>
  `);
});

export default router;
