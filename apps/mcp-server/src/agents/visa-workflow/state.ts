import { Annotation } from "@langchain/langgraph";
import type { OfficialCsvData } from "../../data/csv-schema.js";

export const VisaWorkflowState = Annotation.Root({
  // コンテキスト（入力データ）
  applicant_data: Annotation<Partial<OfficialCsvData>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  
  // 監査ノードで発見された不足フィールド
  missing_fields: Annotation<string[]>({
    reducer: (curr, update) => update,
    default: () => [],
  }),
  
  // 最終的に生成されたドキュメントのURLや結果
  generated_documents: Annotation<string[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  
  // 現在のステータス管理
  status: Annotation<"auditing" | "waiting_for_human" | "generating" | "completed" | "error">({
    reducer: (curr, update) => update,
    default: () => "auditing",
  })
});

export type VisaState = typeof VisaWorkflowState.State;
