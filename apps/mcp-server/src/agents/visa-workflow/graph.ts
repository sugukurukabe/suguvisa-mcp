import { StateGraph, START, END } from "@langchain/langgraph";
import { VisaWorkflowState } from "./state.js";
import { auditNode, notificationNode, generationNode } from "./nodes.js";

// StateGraphを初期化
export const visaGraphBuilder = new StateGraph(VisaWorkflowState)
  .addNode("audit", auditNode)
  .addNode("notification", notificationNode)
  .addNode("generation", generationNode)
  
  // 1. まずは Audit (監査) ノードへ
  .addEdge(START, "audit")
  
  // 2. Audit ノードの判定
  .addConditionalEdges(
    "audit",
    (state) => {
      if (state.status === "waiting_for_human") {
        return "human";
      }
      if (state.status === "generating") {
        return "gen";
      }
      return "end";
    },
    {
      human: "notification",
      gen: "generation",
      end: END,
    }
  )

  // 3. Notification の次は、一旦終了または監査のやり直し待ちへ
  // （本番環境では interrupt で一時停止し、ユーザーからの入力イベントで再開する）
  .addEdge("notification", "audit")

  // 4. Generation が終わったら終了
  .addEdge("generation", END);

// Compile the graph (export app for easy use, but also export builder)
import { MemorySaver } from "@langchain/langgraph";
const checkpointer = new MemorySaver();
export const visaWorkflowApp = visaGraphBuilder.compile({ checkpointer, interruptAfter: ["notification"] });

