import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ruleSets = require("../data/rule-sets.json");

/**
 * 申請結果のフィードバックスキーマ
 * Submission outcome feedback schema
 * Skema umpan balik hasil pengajuan
 */
const submissionOutcomeSchema = z.object({
  pattern_id: z.string().describe(
    "申請パターンID（suguvisa_application_type_determine の結果を使用。例: 'CHANGE_SSW1_C'） / Application pattern ID from suguvisa_application_type_determine"
  ),
  lookup_key: z.string().describe(
    "ルックアップキー（例: '技能実習2号_特定技能1号'） / Lookup key e.g. '技能実習2号_特定技能1号'"
  ),
  result: z.enum(["ACCEPTED", "REVISION_REQUIRED", "REJECTED"]).describe(
    "入管からの最終結果 — ACCEPTED: 許可, REVISION_REQUIRED: 補正指示, REJECTED: 不許可 / Final immigration result"
  ),
  industry_field: z.string().optional().describe(
    "分野（例: '農業', '介護'） / Industry field"
  ),
  revision_codes: z.array(z.string()).optional().describe(
    "補正指示のエラーコードまたは指摘事項（REVISION_REQUIRED の場合に記入） / Revision error codes"
  ),
  revision_details: z.string().optional().describe(
    "補正内容の詳細テキスト（入管からの指摘内容を自由記述） / Detailed revision instructions"
  ),
  document_hash: z.string().optional().describe(
    "生成書類のSHA-256ハッシュ（追跡用、省略可能） / Document hash for tracking"
  ),
  confidence_score: z.number().min(0).max(1).optional().describe(
    "書類生成時のAI確信度（0.0〜1.0） / AI confidence score at generation time"
  ),
  submitted_at: z.string().optional().describe(
    "入管への提出日（YYYY-MM-DD） / Submission date to immigration"
  ),
  result_received_at: z.string().optional().describe(
    "結果受領日（YYYY-MM-DD） / Date result was received"
  ),
  immigration_office: z.string().optional().describe(
    "提出先の入管局名（例: '福岡入管', '東京入管'） / Immigration office name"
  ),
});

/**
 * 同一パターンの補正率を計算する
 * Calculate revision rate for the same pattern
 * Menghitung tingkat revisi untuk pola yang sama
 */
export interface PatternStats {
  total: number;
  accepted: number;
  revision_required: number;
  rejected: number;
  revision_rate: number;
  acceptance_rate: number;
  common_revision_codes: string[];
}

export async function calculatePatternStats(
  supabase: SupabaseClient,
  patternId: string
): Promise<PatternStats | null> {
  const { data, error } = await supabase
    .from("submission_outcomes")
    .select("result, revision_codes")
    .eq("pattern_id", patternId);

  if (error || !data || data.length === 0) {
    return null;
  }

  const rows = data as { result: string; revision_codes: string[] | null }[];
  const total = rows.length;
  const accepted = rows.filter((d) => d.result === "ACCEPTED").length;
  const revision_required = rows.filter((d) => d.result === "REVISION_REQUIRED").length;
  const rejected = rows.filter((d) => d.result === "REJECTED").length;

  // 補正コードの集計
  // Aggregate revision codes
  // Mengumpulkan kode revisi
  const codeCount: Record<string, number> = {};
  rows.forEach((d) => {
    if (d.revision_codes && Array.isArray(d.revision_codes)) {
      d.revision_codes.forEach((code: string) => {
        codeCount[code] = (codeCount[code] || 0) + 1;
      });
    }
  });

  const common_revision_codes = Object.entries(codeCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([code]) => code);

  return {
    total,
    accepted,
    revision_required,
    rejected,
    revision_rate: total > 0 ? revision_required / total : 0,
    acceptance_rate: total > 0 ? accepted / total : 0,
    common_revision_codes,
  };
}

export function registerTrackSubmissionOutcome(server: McpServer) {
  server.tool(
    "suguvisa_submission_outcome_track",
    "入管への申請結果（許可・補正・不許可）をフィードバックとして記録します。このデータにより、申請パターンごとの補正率を統計的に算出し、システムの自己改善に活用します。" +
    " / Record immigration submission outcomes for HITL feedback loop." +
    " / Mencatat hasil pengajuan imigrasi untuk loop umpan balik HITL.",
    submissionOutcomeSchema.shape,
    { title: "Track submission outcome", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (params) => {
      // パターンIDの存在確認
      // Validate pattern_id exists in rule-sets
      // Validasi pattern_id ada di rule-sets
      const validPatterns = Object.keys(ruleSets.application_patterns);
      if (!validPatterns.includes(params.pattern_id)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "error",
              message: `無効な pattern_id です: ${params.pattern_id}`,
              message_en: `Invalid pattern_id: ${params.pattern_id}`,
              hint: `有効な値: ${validPatterns.join(", ")}`,
              _ai_instructions: "ユーザーに正しい pattern_id を選択するよう促してください。suguvisa_application_type_determine の結果から取得した pattern_id を使ってください。",
            }, null, 2),
          }],
        };
      }

      const rawSupabaseUrl = process.env.SUPABASE_URL || "";
      const rawSupabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
      const supabaseUrl = rawSupabaseUrl.trim();
      const supabaseKey = rawSupabaseKey.trim();

      // Supabase未設定のフォールバック（ローカルモード）
      // Fallback if Supabase is not configured (local mode)
      // Cadangan jika Supabase tidak dikonfigurasi (mode lokal)
      if (!supabaseUrl || !supabaseKey) {
        const patternInfo = ruleSets.application_patterns[params.pattern_id];
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "recorded_locally",
              message: "Supabase未設定のためローカルに記録しました。統計機能を有効にするには .env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください。",
              message_en: "Recorded locally. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env to enable statistics.",
              recorded: {
                pattern_id: params.pattern_id,
                pattern_name: patternInfo?.formal_name || params.pattern_id,
                result: params.result,
                revision_codes: params.revision_codes || [],
              },
              _ai_instructions: params.result === "REVISION_REQUIRED"
                ? "⚠️ 補正が指示されました。revision_details の内容をユーザーに見やすく提示し、次回の申請で同じ指摘を受けないよう改善点をまとめてください。"
                : params.result === "ACCEPTED"
                ? "🎉 申請が許可されました！ と伝えてください。次のステップ（在留カードの受取り、市区町村への届出等）を案内してください。"
                : "❌ 不許可となりました。不服申立ての期限と手続きを案内してください。特定行政書士への相談を推奨してください。",
            }, null, 2),
          }],
        };
      }

      // Supabaseに記録
      // Record to Supabase
      // Merekam ke Supabase
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: insertError } = await supabase
        .from("submission_outcomes")
        .insert({
          pattern_id: params.pattern_id,
          lookup_key: params.lookup_key,
          industry_field: params.industry_field || null,
          result: params.result,
          revision_codes: params.revision_codes || null,
          revision_details: params.revision_details || null,
          document_hash: params.document_hash || null,
          rule_set_version: ruleSets.version,
          confidence_score: params.confidence_score || null,
          submitted_at: params.submitted_at || null,
          result_received_at: params.result_received_at || null,
          immigration_office: params.immigration_office || null,
        });

      if (insertError) {
        console.error("Failed to record submission outcome:", insertError);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "error",
              message: `記録に失敗しました: ${insertError.message}`,
              message_en: `Failed to record: ${insertError.message}`,
            }, null, 2),
          }],
        };
      }

      // 同一パターンの統計を算出
      // Calculate statistics for the same pattern
      // Menghitung statistik untuk pola yang sama
      const stats = await calculatePatternStats(supabase, params.pattern_id);
      const patternInfo = ruleSets.application_patterns[params.pattern_id];

      // 補正率が高い場合の警告を判定
      // Determine warning if revision rate is high
      const revisionWarning = stats && stats.revision_rate > 0.2
        ? `⚠️ このパターン（${params.pattern_id}）の補正率は ${(stats.revision_rate * 100).toFixed(1)}% です。ルールセットのレビューを推奨します。`
        : null;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "success",
            message: "申請結果を記録しました",
            message_en: "Submission outcome recorded successfully",
            message_id: "Hasil pengajuan berhasil dicatat",
            recorded: {
              pattern_id: params.pattern_id,
              pattern_name: patternInfo?.formal_name || params.pattern_id,
              route: `${patternInfo?.from_visa || "?"} → ${patternInfo?.to_visa || "?"}`,
              result: params.result,
              revision_codes: params.revision_codes || [],
            },
            pattern_statistics: stats
              ? {
                  total_submissions: stats.total,
                  acceptance_rate: `${(stats.acceptance_rate * 100).toFixed(1)}%`,
                  revision_rate: `${(stats.revision_rate * 100).toFixed(1)}%`,
                  rejection_rate: `${((stats.rejected / stats.total) * 100).toFixed(1)}%`,
                  most_common_revision_codes: stats.common_revision_codes,
                }
              : null,
            revision_warning: revisionWarning,
            _ai_instructions:
              params.result === "REVISION_REQUIRED"
                ? "⚠️ 補正が指示されました。以下の情報をユーザーに分かりやすく提示してください：\n" +
                  "1. 補正コードと詳細内容を表形式で表示\n" +
                  "2. 同一パターンの統計（補正率・よくある指摘）を提示\n" +
                  "3. 次回申請時の改善ポイントを箇条書きで提案\n" +
                  (revisionWarning ? `4. ${revisionWarning}` : "")
                : params.result === "ACCEPTED"
                ? "🎉 申請が許可されました！ユーザーを祝福し、以下を案内してください：\n" +
                  "1. 在留カード受取りまでの流れ\n" +
                  "2. 市区町村への住所届出（14日以内）\n" +
                  "3. 統計情報を表示して、このパターンの成功率を強調"
                : "❌ 不許可の結果です。以下を案内してください：\n" +
                  "1. 不服申立て（再審情報提供）の可能性と期限\n" +
                  "2. 特定行政書士への相談を強く推奨\n" +
                  "3. suguvisa_submission_outcome_track で蓄積されたデータが不服申立てのエビデンスになることを伝える",
          }, null, 2),
        }],
      };
    }
  );
}
