import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { determinePattern } from "../tools/determine-application.js";
import { createOfflineExcel } from "../tools/generate-annual-report-offline.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Define tools
const determineTool = tool(
  async ({ from_visa, to_visa, context, has_supervisor_experience }) => {
    let final_to_visa = to_visa;
    let final_context = context;
    if (to_visa === "特定技能2号" && has_supervisor_experience === false) {
      final_to_visa = "特定活動";
      final_context = "2号移行準備";
    }
    return JSON.stringify(determinePattern(from_visa, final_to_visa, final_context));
  },
  {
    name: "determine_visa_pattern",
    description: "Determines the next required visa application pattern and required documents.",
    schema: z.object({
      from_visa: z.string(),
      to_visa: z.string(),
      context: z.string().optional(),
      has_supervisor_experience: z.boolean().optional(),
    }),
  }
);

const employeeSchema = z.object({
  residence_card_number: z.string().describe("在留カード番号英字数字混在12桁 例:AB12345678CD"),
  family_name_romaji: z.string().describe("姓のローマ字"),
  given_name_romaji: z.string().describe("名のローマ字"),
  date_of_birth: z.string().describe("YYYYMMDD"),
  sex: z.string().describe("1(男) or 2(女)"),
  working_days: z.string().describe("出勤日数"),
  paid_leave_days: z.string().describe("有給取得日数"),
  monthly_salary_average: z.string().describe("平均月給"),
  support_interview_date: z.string().optional().describe("面談日 YYYYMMDD"),
  support_status_code: z.string().describe("1(適切) 2(委託) 3(未実施)"),
});

const generateOfflineReportTool = tool(
  async ({ company_name, reporting_year, employees }) => {
    // LLMがデータを生成しなかった場合のフォールバックテスト用ダミーデータ
    const data = (employees && employees.length > 0) ? employees : [
      {
         residence_card_number: "AB12345678CD", family_name_romaji: "NGUYEN", given_name_romaji: "VAN MINH",
         date_of_birth: "19950101", sex: "1", working_days: "60", paid_leave_days: "2",
         monthly_salary_average: "220000", support_interview_date: "20260315", support_status_code: "1"
      },
      {
         residence_card_number: "XY87654321ZZ", family_name_romaji: "TRAN", given_name_romaji: "THI HOA",
         date_of_birth: "19981212", sex: "2", working_days: "65", paid_leave_days: "0",
         monthly_salary_average: "215000", support_interview_date: "20260316", support_status_code: "1"
      }
    ];

    try {
      const savedPath = await createOfflineExcel(company_name, reporting_year, data);
      return `株式会社${company_name}の定期報告書（オフライン紙面向け）を作成しました。\n\n[WIDGET:DOWNLOAD]\n保存先: ${savedPath}`;
    } catch (e: any) {
      return `自動生成中にエラーが発生しました: ${e.message}`;
    }
  },
  {
    name: "generate_offline_report",
    description: "Generates an offline annual report (Excel format) for a registered company. Generate sample employee data if not explicitly provided.",
    schema: z.object({
      company_name: z.string(),
      reporting_year: z.number(),
      employees: z.array(employeeSchema).optional().describe("リストがない場合はテスト用のダミーが使われます。"),
    }),
  }
);

const baseLlm = new ChatVertexAI({
  modelName: "gemini-2.5-pro",
  maxOutputTokens: 2048,
});

// Create an automated tool-calling agent
const agent = createReactAgent({
  llm: baseLlm,
  tools: [determineTool, generateOfflineReportTool],
});

export async function processChatMessage(messages: any[]) {
    try {
        // Invoke the agent (it will automatically loop and call determineTool if needed)
        const result = await agent.invoke({ messages });
        
        // The last message in the state is the final AI response
        const finalMsg = result.messages[result.messages.length - 1];
        
        return {
           content: finalMsg.content
        };
    } catch (err: any) {
        if (err.message && err.message.includes("ENOENT") && err.message.includes("gcs-key.json")) {
            const lastMsg = messages[messages.length - 1];
            const userText = (lastMsg && lastMsg.content) ? lastMsg.content : (Array.isArray(lastMsg) ? lastMsg[1] : "入力内容");
            
            let demoResponse = `【Vertex AI オフラインモード】\nダミー応答モードで動作しています。(gcs-key.jsonが設定されていません)\n\n`;
            
            if (userText.includes("定期報告") || userText.includes("オフライン")) {
                demoResponse += `株式会社スグクルの2026年度版・定期報告（オフライン紙面提出用）データを処理しました。\nフォーマットに基づくExcelファイルを自動生成しましたので、以下よりダウンロードして内容をご確認ください。\n\n[WIDGET:DOWNLOAD]`;
            } else if (userText.includes("特定技能１号") || userText.includes("特定技能1号")) {
                demoResponse += `「特定技能1号から他社での特定技能1号」への転職ですね。\nAIエージェントの判定では、「特定技能1号の在留資格変更許可申請」が必要です。\n\n必要な主な書類:\n・ 在留資格変更許可申請書\n・ 雇用条件書\n・ 雇用の経緯説明書\n・ 派遣先概要書（派遣の場合）\nになります。`;
            } else {
                demoResponse += `お問い合わせ：「${userText}」\n正規の回答を生成するには、本番環境のキーを設定してください。`;
            }
            return { content: demoResponse };
        }
        throw err;
    }
}
