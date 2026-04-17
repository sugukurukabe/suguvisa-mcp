import { Annotation } from "@langchain/langgraph";

export const DispatchWorkflowState = Annotation.Root({
  // コンテキスト（入力データ）
  worker_name: Annotation<string>(),
  company_name: Annotation<string>(),
  stage: Annotation<"start" | "add" | "renew" | "change">(),
  
  // 監査ノードで発見された不足フィールド
  missing_fields: Annotation<string[]>({
    reducer: (curr, update) => update,
    default: () => [],
  }),
  
  // 人間（Human-in-the-Loop）から提供されたデータ
  provided_data: Annotation<Record<string, string | number>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  
  // 最終的に生成されたドキュメントのURLや結果
  generated_documents: Annotation<string[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  
  // 現在のステータス管理
  status: Annotation<"auditing" | "waiting_for_human" | "generating" | "completed">({
    reducer: (curr, update) => update,
    default: () => "auditing",
  })
});

export type DispatchState = typeof DispatchWorkflowState.State;
