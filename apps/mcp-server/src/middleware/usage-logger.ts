import { supabase } from "../lib/supabase.js";
import type { AuthRequest } from "./auth.js";

/**
 * ツールの実行ログを非同期でSupabaseに保存する
 * 
 * 課金用、またはエラー監視用に使用。MCPサーバーの応答をブロックしないように非同期で投げてFire-and-Forgetする。
 */
export async function logUsage(
  req: AuthRequest,
  toolName: string,
  status: "success" | "error",
  durationMs: number,
  errorMessage?: string
) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    // DB未設定時はスキップ（ローカル利用など）
    return;
  }

  const tenantId = req.tenant?.id;
  if (!tenantId || tenantId === "local-dev-tenant") {
    // 開発用ローカルトークンの場合は記録しない
    return;
  }

  try {
    // Fire and forget
    supabase
      .from("api_usage_logs")
      .insert({
        tenant_id: tenantId,
        tool_name: toolName,
        status: status,
        duration_ms: durationMs,
        error_message: errorMessage || null,
      })
      .then(({ error }) => {
        if (error) {
          console.error(`[Usage Logger] Failed to insert log for ${toolName}:`, error.message);
        }
      });
  } catch (e) {
    console.error("[Usage Logger] Unexpected error logging usage:", e);
  }
}
