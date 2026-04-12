import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const logVisaActionSchema = z.object({
  tenant_id: z.string().uuid().optional().describe("事業者テナントID (未指定時環境変数からフォールバック)"),
  actor: z.string().describe("実行者 (例: 'SuguKuru Core', 'Yoshihara')"),
  action_type: z.string().describe("アクション内容 (例: 'GENERATE_ANNUAL_REPORT', 'VALIDATE_DATA')"),
  target_resource: z.string().optional().describe("対象のリソースIDや氏名 (例: 'GILANG PERMANA')"),
  metadata: z.record(z.any()).optional().describe("追加のメタデータ (JSON形式)")
});

export async function logVisaActionHandler(
  args: z.infer<typeof logVisaActionSchema>
) {
  const rawSupabaseUrl = process.env.SUPABASE_URL || "";
  const rawSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const supabaseUrl = rawSupabaseUrl.trim();
  const supabaseKey = rawSupabaseKey.trim();
  const defaultTenantId = process.env.DEFAULT_TENANT_ID;

  const tenantIdToUse = args.tenant_id || defaultTenantId;

  // ローカル環境等でDB接続先がない場合はモックとして成功を返す（安全なフォールバック）
  if (!supabaseUrl || !supabaseKey) {
    console.log("[MOCK] log_visa_action:", {
      tenant_id: tenantIdToUse || "mock-tenant-id",
      actor: args.actor,
      action_type: args.action_type,
      target_resource: args.target_resource,
      metadata: args.metadata,
      timestamp: new Date().toISOString()
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "success_mock",
              message: "Audit log recorded successfully (Mock mode). Supabase credentials not found.",
              log_id: "mock-log-" + Date.now(),
              actor: args.actor,
              action_type: args.action_type
            },
            null,
            2
          )
        }
      ]
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from("visa_audit_logs")
      .insert({
        tenant_id: tenantIdToUse,
        actor: args.actor,
        action_type: args.action_type,
        target_resource: args.target_resource,
        metadata: args.metadata
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error(`Failed to record audit log: ${error.message}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "success",
              message: "Audit log recorded successfully.",
              log_id: data.id,
              created_at: data.created_at,
              actor: data.actor,
              action_type: data.action_type
            },
            null,
            2
          )
        }
      ]
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error recording audit log: ${error.message}`
        }
      ]
    };
  }
}

export function registerLogVisaAction(server: any) {
  server.tool(
    "log_visa_action",
    "【操作ログ記録】ビザ申請業務の全アクション（書類確認・提出・結果受領等）を監査ログとしてSupabaseに記録。コンプライアンス対応と業務トレーサビリティを確保。 / Records all visa processing actions as audit logs in Supabase for compliance and traceability.",
    logVisaActionSchema.shape,
    async (args: any, extra: any) => {
      // 処理のキャンセルを可能にする対応
      if (extra?._cancel && extra._cancel.isCanceled) {
         throw new Error("Request canceled");
      }
      return await logVisaActionHandler(args);
    }
  );
}
