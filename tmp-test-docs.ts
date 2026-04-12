import { determinePattern } from "./src/tools/determine-application.js";
import { getRequiredDocumentsData } from "./src/tools/required-documents.js";

const input = {
  name: "壁 晃弘",
  nationality: "中国",
  dob: "2000-07-07",
  wage: "1000",
  start_date: "2024-05-01", // Assuming
  contract_length: "1年",
  field: "農業",
  current_visa: "留学",
  target_visa: "特定技能1号",
  employer: "青空農園（個人事業）"
};

console.log("=== 1. 申請パターンの自動判定 ===");
const determineResult = determinePattern("留学", "特定技能1号");
if (!determineResult) {
  console.log("判定失敗");
  process.exit(1);
}

console.log(`判定結果: ${determineResult.pattern.short_name} (${determineResult.patternId})`);
console.log(`必要日数目安: ${determineResult.pattern.typical_processing_days}`);
console.log(`特記事項:`);
determineResult.pattern.notes?.forEach(n => console.log(` - ${n}`));

console.log("\n=== 2. 必要書類リストの生成 ===");
console.log(`分野: ${input.field}, 支援形態: 委託(デフォルト), 初回申請(国内)`);

const docsResult = getRequiredDocumentsData({
  pattern_id: determineResult.patternId,
  industry_field: input.field,
  support_type: "delegated",
  is_domestic: true,
  is_same_employer_2year: false
});

console.log(`\n【基本書類サマリー】`);
console.log(`対象正式名称: ${docsResult.formal_name}`);
console.log(`提出書類総数: ${docsResult.total_documents}件`);

if (docsResult.documents) {
  const commonDocs = docsResult.documents.filter((d: any) => d.category.includes("共通"));
  console.log(`\n📄 [共通書類など] ${commonDocs.length}件`);
  commonDocs.slice(0, 3).forEach((d: any) => console.log(`   - ${d.name} (${d.who || "誰か"})`));
  console.log(`   ...他 ${commonDocs.length - 3}件`);

  const supportDocs = docsResult.documents.filter((d: any) => d.category.includes("支援"));
  console.log(`\n📄 [支援関連書類] ${supportDocs.length}件`);
  supportDocs.forEach((d: any) => console.log(`   - ${d.name}`));

  const fieldDocs = docsResult.documents.filter((d: any) => d.category.includes("分野固有"));
  console.log(`\n📄 [分野固有: ${input.field}] ${fieldDocs.length}件`);
  fieldDocs.forEach((d: any) => console.log(`   - ${d.name} (様式: ${d.reference_form_number || "指定なし"})`));

  const specialDocs = docsResult.documents.filter((d: any) => d.category.includes("パターン固有"));
  console.log(`\n📄 [パターン固有 (留学生→SSW1)] ${specialDocs.length}件`);
  specialDocs.forEach((d: any) => console.log(`   - ${d.name}`));
}

console.log("\n=== 3. 試験免除要件の確認 ===");
console.log(JSON.stringify(docsResult.exam_exemption, null, 2));

