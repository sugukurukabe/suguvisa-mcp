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
    name_for_human: "SuguVisa - ビザ申請AI",
    name_for_model: "suguvisa",
    description_for_human: "日本の特定技能ビザ（在留資格）申請を自動化するAIプラグイン。申請種別の判定、必要書類リスト、期限計算、データ検証、定期報告書の自動生成に対応。",
    description_for_model:
      "SuguVisa is an expert tool for Japanese Specified Skilled Worker (SSW/特定技能) visa applications. " +
      "Use it to: (1) determine the correct application type from current→target visa, " +
      "(2) get a complete list of required documents, (3) calculate all relevant deadlines, " +
      "(4) validate applicant data fields, (5) generate annual periodic reports in CSV or Excel. " +
      "Always call 'determine' first to get a pattern_id, then pass it to other endpoints.",
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
