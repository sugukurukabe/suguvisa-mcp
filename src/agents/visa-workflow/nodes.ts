import type { VisaState } from "./state.js";
import { officialCsvSchema } from "../../data/csv-schema.js";
import { generateBulkXlsmHandler } from "../../tools/generate-bulk-xlsm.js";

// 1. AuditNode
export const auditNode = async (state: VisaState): Promise<Partial<VisaState>> => {
  const parsed = officialCsvSchema.safeParse(state.applicant_data);
  
  if (parsed.success) {
    // データが完璧に揃っている場合
    return {
      status: "generating",
      missing_fields: [],
    };
  } else {
    // 欠損データがある場合
    const missing = parsed.error.issues.map(i => i.path.join("."));
    return {
      status: "waiting_for_human",
      missing_fields: missing,
    };
  }
};

// 2. NotificationNode (Human-in-the-Loop)
export const notificationNode = async (state: VisaState): Promise<Partial<VisaState>> => {
  // 実際にはここで Slack への Incoming Webhook や、DBのステータス更新を行う
  console.log(`[SlackBot notifying Human] 以下の情報が不足しています。対象者をチェックしてデータを入力してください:`);
  console.log(state.missing_fields.join(", "));
  
  // このノードを通過する際、ワークフローエンジン (Graph) 側で interrupt を発火させる仕組みを取ります。
  return {
    status: "waiting_for_human"
  };
};

// 3. GenerationNode
export const generationNode = async (state: VisaState): Promise<Partial<VisaState>> => {
  try {
    // application_type: 変更(3) をデフォルトとする (実際にはStateから取得すべきだが一旦テスト用に固定)
    const appType = state.applicant_data?.application_type || "3";
    
    // generateBulkXlsmHandler expects applicants array
    const applicants = [state.applicant_data as any];
    
    const result = await generateBulkXlsmHandler(appType as ("1"|"2"|"3"), applicants);
    
    // Extract file info from result content Text
    let outputString = "generated.xlsm";
    
    if (result && result.content && result.content.length > 0) {
      const parsedText = JSON.parse(result.content[0].text);
      if (parsedText.status === "success") {
        outputString = parsedText.output_path;
      } else {
        throw new Error(parsedText.message);
      }
    }

    return {
      status: "completed",
      generated_documents: [outputString]
    };
  } catch (error: any) {
    console.error("生成エラー:", error);
    return {
      status: "error"
    };
  }
};
