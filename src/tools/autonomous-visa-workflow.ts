import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { visaWorkflowApp } from "../agents/visa-workflow/graph.js";

export function registerAutonomousVisaWorkflow(server: McpServer) {
  server.tool(
    "start_autonomous_visa_workflow",
    "LangGraphによる自律型ビザ申請ワークフローを開始します。不足データがある場合は途中で止まります。",
    {
      thread_id: z.string().describe("このフローの一意なスレッドID。人間が再開する時にも使用します。"),
      applicant_data: z.record(z.any()).describe("申請データの初期値"),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ thread_id, applicant_data }) => {
      const config = { configurable: { thread_id } };
      const resultState = await visaWorkflowApp.invoke({ applicant_data }, config);
      
      const snapshot = await visaWorkflowApp.getState(config);
      if (snapshot.next && snapshot.next.includes("audit")) {
        // Interrupted at notification
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "waiting_for_human",
              message: "不足情報があるためワークフローが一時停止しました。resume_autonomous_visa_workflow を使って再開してください。",
              missing_fields: snapshot.values.missing_fields,
              _ai_instructions: "ユーザーに対して、不足している情報を箇条書き（Markdownチェックリスト形式）で提示し、情報提供を求めてください。進行状況を示すため『現在データ監査ステップで停止中です』と伝えると親切です。"
            }, null, 2)
          }]
        };
      }
      
      // Completed or other final status
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
              status: resultState.status,
              message: "ワークフローが終了しました",
              generated_documents: resultState.generated_documents
          }, null, 2)
        }]
      };
    }
  );

  server.tool(
    "resume_autonomous_visa_workflow",
    "一時停止した自律型ワークフローに人間の入力を与えて再開します。",
    {
      thread_id: z.string().describe("再開するスレッドID"),
      human_update: z.record(z.any()).describe("申請データに対して人間が追加・修正したフィールド。例: { applicant_data: { nationality_code: 'USA' } }")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ thread_id, human_update }) => {
      const config = { configurable: { thread_id } };
      
      const snapshot = await visaWorkflowApp.getState(config);
      if (!snapshot || !snapshot.next || snapshot.next.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "error", message: "指定されたスレッドの再開可能なワークフローが見つかりません" }, null, 2)
          }]
        };
      }

      // Update state at the node it paused (notification)
      await visaWorkflowApp.updateState(config, human_update, "notification");

      const finalState = await visaWorkflowApp.invoke(null, config);
      const newSnapshot = await visaWorkflowApp.getState(config);

      if (newSnapshot.next && newSnapshot.next.includes("audit")) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "waiting_for_human",
              message: "まだ不足情報があるかバリデーションに失敗したため、再度一時停止しました。",
              missing_fields: newSnapshot.values.missing_fields,
              _ai_instructions: "ユーザーから提供された情報だけでは足りない、または不備がありました。引き続き残りの不足フィールドをユーザーに聞いてください。Markdownチェックリストを使うと効果的です。"
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
              status: finalState.status,
              message: "ワークフローが終了しました",
              generated_documents: finalState.generated_documents,
              _ai_instructions: "書類生成がすべて完了しました！🎉 とユーザーに祝いの言葉をかけ、生成されたURLをリンクとして提示してください。"
          }, null, 2)
        }]
      };
    }
  );
}
