import { describe, it, expect } from "vitest";
import { officialCsvSchema } from "../../data/csv-schema.js";

/**
 * 20パターンの網羅的E2Eテスト
 * various cases including application_types, employment_types
 */

describe("E2E Test Matrix for Validation (20 Patterns)", () => {
  const baseApplicant = {
    family_name_romaji: "TEST",
    given_name_romaji: "USER",
    nationality_code: "IDN",
    date_of_birth: "19900101",
    sex: "1",
    passport_number: "A1234567",
    desired_visa_type: "特定技能１号",
    desired_period: "1年",
    company_name: "テスト農園",
    corporate_number: "1234567890123",
    industry_field_code: "0100", // 農業
    work_description: "農作業全般",
    monthly_salary: "200000",
    contract_start_date: "20260401",
    company_address: "北海道札幌市",
    company_phone: "011-111-2222",
    representative: "青木 次郎",
  };

  const scenarios = [
    // --- 認定 (type 1) ---
    { id: "01", type: "1", comment: "認定 - 農業 - 直接雇用 - 法人", modifications: {} },
    { id: "02", type: "1", comment: "認定 - 農業 - 無期派遣 - 個人事業主 (法人番号なし)", modifications: { corporate_number: "                 " } }, // Blank or spaces allowed if mapped to empty
    { id: "03", type: "1", comment: "認定 - 建設 - 有期派遣 - 法人", modifications: { industry_field_code: "0300" } }, // 建設
    { id: "04", type: "1", comment: "認定 - 宿泊 - 直接雇用 - 法人 - 給料全角表記", modifications: { industry_field_code: "1000", monthly_salary: "２０００００" } }, // 宿泊, salary test
    
    // --- 更新 (type 2) ---
    { id: "05", type: "2", comment: "更新 - 飲食料品製造 - 直接雇用", modifications: { application_type: "2", industry_field_code: "1200" } },
    { id: "06", type: "2", comment: "更新 - 外食 - 直接雇用", modifications: { application_type: "2", industry_field_code: "1300" } },
    { id: "07", type: "2", comment: "更新 - ビルクリーニング - 直接雇用", modifications: { application_type: "2", industry_field_code: "0200" } },
    { id: "08", type: "2", comment: "更新 - 介護 - 直接雇用 - 名前全角アルファベット混入", modifications: { application_type: "2", industry_field_code: "0000", family_name_romaji: "ＴＥＳＴ" } },
    
    // --- 変更 (type 3) ---
    { id: "09", type: "3", comment: "変更 - 農業 - 無期派遣 - 技能実習からの移行", modifications: { application_type: "3", industry_field_code: "0100" } },
    { id: "10", type: "3", comment: "変更 - 自動車整備 - 直接雇用", modifications: { application_type: "3", industry_field_code: "0600" } },
    { id: "11", type: "3", comment: "変更 - 航空 - 直接雇用", modifications: { application_type: "3", industry_field_code: "0900" } },
    
    // --- エッジケース (Edge Cases) ---
    { id: "12", type: "1", comment: "認定 - 半角カナ混じりの名前 (サニタイズテスト)", modifications: { family_name_romaji: "TEST-ALPHA" } },
    { id: "13", type: "1", comment: "認定 - 誕生日が和暦表記", modifications: { date_of_birth: "平成5年4月1日" } }, // Parser supports YYYYMMDD mainly in schema, unless parser fixes it beforehand. wait, schema parses date!
    { id: "14", type: "2", comment: "更新 - 在留カード情報あり", modifications: { application_type: "2", residence_card_number: "AB12345678CD" } },
    { id: "15", type: "3", comment: "変更 - パスポート欠損 (提出できない場合のシナリオ)", modifications: { application_type: "3", passport_number: "申請中" } }, // Some alphabets maybe stripped?
    { id: "16", type: "1", comment: "認定 - 異常な電話番号 (記号混入)", modifications: { company_phone: "０９０ー１２３４ー５６７８" } },
    { id: "17", type: "3", comment: "変更 - 派遣先情報入り (農業)", modifications: { application_type: "3", work_location: "農場A", dispatch_company: "派遣元B" } }, // Just extra fields ignored or validated
    { id: "18", type: "2", comment: "更新 - 旧形式の日付", modifications: { application_type: "2", contract_start_date: "2025/11/01" } },
    { id: "19", type: "1", comment: "認定 - 月給で『時給1000円』のような不要テキスト", modifications: { monthly_salary: "160000円" } }, 
    { id: "20", type: "3", comment: "変更 - 極端に短い名前", modifications: { application_type: "3", family_name_romaji: "A", given_name_romaji: "B" } },
  ];

  for (const scenario of scenarios) {
    it(`Case ${scenario.id}: ${scenario.comment}`, () => {
      const applicantData = {
        application_type: scenario.type,
        ...baseApplicant,
        ...scenario.modifications,
      };

      const parsed = officialCsvSchema.safeParse(applicantData);
      
      // Some modifications like "平成5年4月1日" might fail if csv-schema doesn't convert era inside Zod (it uses parseDateString usually outside).
      // We will assert true and see which ones fail.
      if (!parsed.success) {
        console.error(`Case ${scenario.id} failed:`, parsed.error.issues);
      }
      expect(parsed.success).toBe(true);

      if (parsed.success) {
         // Sanity checks on specific transformations
         if (scenario.id === "04") expect(parsed.data.monthly_salary).toBe("200000");
         if (scenario.id === "08") expect(parsed.data.family_name_romaji).toBe("TEST");
         if (scenario.id === "16") expect(parsed.data.company_phone).toBe("090-1234-5678");
         if (scenario.id === "19") expect(parsed.data.monthly_salary).toBe("160000");
         if (scenario.id === "18") expect(parsed.data.contract_start_date).toBe("20251101");
      }
    });
  }
});
