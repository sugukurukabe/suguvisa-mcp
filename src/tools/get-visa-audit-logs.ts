import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const getVisaAuditLogsSchema = z.object({
  target_resource: z.string().optional().describe("対象リソースIDや氏名の一部 (例: 'GILANG', 'case_id: 123')"),
  action_type: z.string().optional().describe("アクション内容による絞り込み (例: 'GENERATE_ANNUAL_REPORT')"),
  limit: z.number().int().positive().max(100).default(50).describe("最大取得件数")
});

export async function getVisaAuditLogsHandler(
  args: z.infer<typeof getVisaAuditLogsSchema>
) {
  const rawSupabaseUrl = process.env.SUPABASE_URL || "";
  const rawSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const supabaseUrl = rawSupabaseUrl.trim();
  const supabaseKey = rawSupabaseKey.trim();

  if (!supabaseUrl || !supabaseKey) {
    console.log("[MOCK] get_visa_audit_logs requested with:", args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "success_mock",
              message: "Returned mock audit logs.",
              logs: [
                {
                  id: "mock-log-1",
                  actor: "VisaWizard AI",
                  action_type: args.action_type || "MOCK_ACTION",
                  target_resource: args.target_resource || "MOCK_TARGET",
                  metadata: { note: "This is a mock response because DB env vars are absent." },
                  created_at: new Date().toISOString()
                }
              ]
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
    let query = supabase
      .from("visa_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(args.limit);

    if (args.action_type) {
      query = query.eq("action_type", args.action_type);
    }

    if (args.target_resource) {
      query = query.ilike("target_resource", `%${args.target_resource}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase select error:", error);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "success",
              logs: data
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
          text: `Error fetching audit logs: ${error.message}`
        }
      ]
    };
  }
}

export function registerGetVisaAuditLogs(server: any) {
  server.tool(
    "get_visa_audit_logs",
    "【監査ログ取得】特定のリソース（申請人・企業等）やイベントに紐づく過去の操作履歴を取得。誰がいつ何をしたかをタイムライン表示し、業務の透明性を担保。 / Retrieves past audit logs for specific resources or events, providing a full timeline of who did what and when.",
    getVisaAuditLogsSchema.shape,
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (args: any, extra: any) => {
      // 処理のキャンセルを可能にする対応
      if (extra?._cancel && extra._cancel.isCanceled) {
         throw new Error("Request canceled");
      }
      return await getVisaAuditLogsHandler(args);
    }
  );
}
