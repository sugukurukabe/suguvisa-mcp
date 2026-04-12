import { determinePattern, buildLookupKey } from "./src/tools/determine-application.js";

console.log("=== 正常系: 技能実習2号 から 特定技能1号 ===");
const result1 = determinePattern("技能実習2号", "特定技能1号");
console.log(JSON.stringify(result1, null, 2));

console.log("\n=== 正常系: 留学 から 特定活動 (就職活動) ===");
const result2 = determinePattern("留学", "特定活動", "job_hunting");
console.log(JSON.stringify(result2, null, 2));

console.log("\n=== 異常系: 存在しないパターン ===");
const result3 = determinePattern("存在しないビザ", "ありえないビザ");
if (!result3) {
  console.log({
    status: "not_found",
    message: "申請パターンが見つかりません: 存在しないビザ → ありえないビザ",
    hint: "from_visa と to_visa を以下の対応表から選んでください"
  });
}
