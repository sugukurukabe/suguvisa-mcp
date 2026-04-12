import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateText, generateWithImage, isVertexAIAvailable } from "../lib/vertex-ai.js";

/**
 * 書類レビューAI — Gemini で申請書類の記入内容をチェック
 */
export function registerReviewDocument(server: McpServer) {
  server.tool(
    "review_document",
    "【AI書類レビュー】申請書類の画像またはテキストをGemini AIが審査官目線でレビュー。記入漏れ・誤記・不許可リスクの高い表現を検出し、修正アドバイスを返す。対応書類: 申請書・雇用契約書・雇用条件書・支援計画書・所属機関概要書・理由書等。 / AI-powered document review using Gemini. Detects missing fields, errors, and risky expressions from an immigration officer's perspective.",
    {
      document_type: z.enum([
        "申請書",
        "雇用契約書",
        "雇用条件書",
        "支援計画書",
        "所属機関概要書",
        "理由書",
        "誓約書",
        "その他",
      ]).describe("レビュー対象の書類種別"),
      image_base64: z.string().optional().describe(
        "書類画像のBase64エンコードデータ / Base64 encoded document image"
      ),
      image_mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]).optional().describe(
        "画像のMIMEタイプ / Image MIME type"
      ),
      document_text: z.string().optional().describe(
        "書類のテキスト内容（画像がない場合） / Document text content if no image"
      ),
      application_pattern: z.string().optional().describe(
        "申請パターンID（例: CHANGE_SSW1_C）。指定するとパターン固有のチェックが追加される"
      ),
    },
    async ({ document_type, image_base64, image_mime_type, document_text, application_pattern }) => {
      if (!image_base64 && !document_text) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "image_base64 または document_text のどちらかを提供してください",
              _ai_instructions: "ユーザーにレビューしたい書類の画像またはテキストを送るよう案内してください",
            }, null, 2),
          }],
        };
      }

      if (!isVertexAIAvailable()) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Vertex AI (Gemini) が設定されていません",
              detail: "GCP_PROJECT_ID 環境変数と認証情報が必要です",
              fallback: "テキストベースの基本チェックは可能です。document_text を提供してください。",
            }, null, 2),
          }],
        };
      }

      const systemPrompt = buildReviewPrompt(document_type, application_pattern);

      let reviewResult: string;
      try {
        if (image_base64 && image_mime_type) {
          reviewResult = await generateWithImage(
            systemPrompt,
            image_base64,
            image_mime_type
          );
        } else {
          reviewResult = await generateText(
            `${systemPrompt}\n\n=== 書類テキスト ===\n${document_text}`,
            false
          );
        }
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "AI レビューの実行中にエラーが発生しました",
              detail: err.message,
              suggestion: "再度お試しください。画像が不鮮明な場合はテキスト入力をお試しください。",
            }, null, 2),
          }],
        };
      }

      // Geminiの返答をパース
      let review: DocumentReview;
      try {
        const jsonMatch = reviewResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          review = JSON.parse(jsonMatch[0]);
        } else {
          review = {
            overall_score: 0,
            risk_level: "unknown",
            issues: [],
            suggestions: [],
            summary: reviewResult,
          };
        }
      } catch {
        review = {
          overall_score: 0,
          risk_level: "unknown",
          issues: [],
          suggestions: [],
          summary: reviewResult,
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            document_type,
            review,
            _ai_instructions: formatAIInstructions(review),
          }, null, 2),
        }],
      };
    }
  );
}

interface DocumentReview {
  overall_score: number;  // 0-100
  risk_level: string;     // "low" | "medium" | "high" | "critical"
  issues: Array<{
    field: string;
    severity: string;
    description: string;
    suggestion: string;
  }>;
  suggestions: string[];
  summary: string;
}

function buildReviewPrompt(documentType: string, pattern?: string): string {
  const patternContext = pattern
    ? `\n申請パターン: ${pattern}（このパターン固有の要件も確認してください）`
    : "";

  return `あなたは日本の入国管理局の審査官であり、特定技能ビザの申請書類を10年以上審査してきたベテランです。
以下の「${documentType}」を審査官の目で厳密にレビューしてください。${patternContext}

レビュー観点:
1. 【記入漏れ】必須項目が空欄になっていないか
2. 【形式エラー】日付形式、住所形式、電話番号形式は正しいか
3. 【整合性】複数の欄の情報に矛盾がないか（例: 雇用期間と在留期間の不一致）
4. 【不許可リスク】審査官が不許可にしやすい表現や記載がないか
5. 【最低賃金】時給・月給が地域の最低賃金を下回っていないか
6. 【法令遵守】労働基準法・入管法に違反する記載がないか

以下のJSON形式で回答してください:
{
  "overall_score": 85,
  "risk_level": "low",
  "issues": [
    {
      "field": "勤務地住所",
      "severity": "high",
      "description": "勤務地の住所が記載されていません",
      "suggestion": "番地まで正確に記載してください（例: 〇〇県〇〇市〇〇町1-2-3）"
    }
  ],
  "suggestions": [
    "雇用条件書の労働時間が週40時間を超える場合は36協定の届出が必要です",
    "時給1,200円は鹿児島県の最低賃金（952円）を上回っており問題ありません"
  ],
  "summary": "全体として良好な書類です。勤務地住所の記入漏れを修正すれば提出可能です。"
}

重要: JSONのみを出力してください。`;
}

function formatAIInstructions(review: DocumentReview): string {
  const score = review.overall_score;
  const issueCount = review.issues?.length || 0;
  const criticalCount = review.issues?.filter(i => i.severity === "critical" || i.severity === "high").length || 0;

  if (score >= 90) {
    return `✅ スコア${score}/100 — 優秀な書類です。${issueCount > 0 ? `軽微な指摘が${issueCount}件あります。` : "指摘事項なし。"} ユーザーに結果を表形式で見やすく表示してください。`;
  } else if (score >= 70) {
    return `⚠️ スコア${score}/100 — 概ね良好ですが${criticalCount > 0 ? `重要な修正が${criticalCount}件あります。` : `${issueCount}件の修正が必要です。`} 各指摘事項を優先度順にユーザーに表示してください。`;
  } else {
    return `🚨 スコア${score}/100 — このまま提出すると不許可リスクがあります。${criticalCount}件の重大な問題があります。修正必須の項目をユーザーに強調して表示してください。`;
  }
}
