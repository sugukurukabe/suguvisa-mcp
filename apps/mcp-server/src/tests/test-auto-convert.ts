/**
 * 自動変換ロジックのユニットテスト
 */
import {
  resolveNationalityCode,
  resolveIndustryFieldCode,
  resolveApplicationType,
  splitRomajiName,
} from "../data/csv-schema.js";

// Test 1: 国籍コード自動変換
console.log("=== Test 1: resolveNationalityCode ===");
const natTests = [
  { input: "IDN", expected: "IDN" },
  { input: "インドネシア", expected: "IDN" },
  { input: "indonesia", expected: "IDN" },
  { input: "ベトナム", expected: "VNM" },
  { input: "フィリピン", expected: "PHL" },
  { input: "中国", expected: "CHN" },
  { input: "usa", expected: "USA" },
];
let pass = 0, fail = 0;
for (const t of natTests) {
  const result = resolveNationalityCode(t.input);
  const ok = result === t.expected;
  console.log(`  ${ok ? "✅" : "❌"} "${t.input}" → "${result}" (expected: "${t.expected}")`);
  if (ok) pass++; else fail++;
}

// Test 2: 分野コード自動変換
console.log("\n=== Test 2: resolveIndustryFieldCode ===");
const fieldTests = [
  { input: "0100", expected: "0100" },
  { input: "農業", expected: "0100" },
  { input: "agriculture", expected: "0100" },
  { input: "介護", expected: "1100" },
  { input: "建設", expected: "0300" },
  { input: "accommodation", expected: "1000" },
];
for (const t of fieldTests) {
  const result = resolveIndustryFieldCode(t.input);
  const ok = result === t.expected;
  console.log(`  ${ok ? "✅" : "❌"} "${t.input}" → "${result}" (expected: "${t.expected}")`);
  if (ok) pass++; else fail++;
}

// Test 3: 申請種別自動推定
console.log("\n=== Test 3: resolveApplicationType ===");
const appTests = [
  { input: "1", expected: "1" },
  { input: "3", expected: "3" },
  { input: "変更", expected: "3" },
  { input: "change", expected: "3" },
  { input: "更新", expected: "2" },
  { input: "renewal", expected: "2" },
  { input: "認定", expected: "1" },
  { input: "COE", expected: "1" },
];
for (const t of appTests) {
  const result = resolveApplicationType(t.input);
  const ok = result === t.expected;
  console.log(`  ${ok ? "✅" : "❌"} "${t.input}" → "${result}" (expected: "${t.expected}")`);
  if (ok) pass++; else fail++;
}

// Test 4: 氏名自動分割
console.log("\n=== Test 4: splitRomajiName ===");
const nameTests = [
  { input: "GILANG PERMANA",   expected: { family: "PERMANA", given: "GILANG" } },
  { input: "ERNA APRILLIYA",   expected: { family: "APRILLIYA", given: "ERNA" } },
  { input: "TRAN VAN HAI",     expected: { family: "HAI", given: "TRAN VAN" } },
  { input: "NGUYEN",           expected: { family: "NGUYEN", given: "" } },
  { input: "muhammad rizky fadillah", expected: { family: "FADILLAH", given: "MUHAMMAD RIZKY" } },
];
for (const t of nameTests) {
  const result = splitRomajiName(t.input);
  const ok = result.family === t.expected.family && result.given === t.expected.given;
  console.log(`  ${ok ? "✅" : "❌"} "${t.input}" → family="${result.family}", given="${result.given}"`);
  if (ok) pass++; else fail++;
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
