import { describe, it, expect } from "vitest";
import { generateBulkXlsmHandler } from "../generate-bulk-xlsm.js";

/**
 * generate_bulk_xlsm ツールのユニットテスト
 * Unit tests for generate_bulk_xlsm tool
 * Unit test untuk alat generate_bulk_xlsm
 *
 * テンプレートファイル未存在のためXlsxPopulate部分はスキップ。
 * バリデーションとエラーハンドリングのテストを行う。
 */
describe("generate_bulk_xlsm", () => {
  it("should return error if applicants array is empty", async () => {
    const result = await generateBulkXlsmHandler("3", []);
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("error");
    expect(parsed.message).toContain("少なくとも1件");
  });

  it("should return validation_error for incomplete applicant data", async () => {
    const result = await generateBulkXlsmHandler("3", [
      {
        family_name_romaji: "TEST",
        // missing most required fields
      },
    ]);
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("validation_error");
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0]).toContain("Row 1");
  });

  it("should validate multiple applicants and report per-row errors", async () => {
    const result = await generateBulkXlsmHandler("1", [
      { family_name_romaji: "ONE" },
      { family_name_romaji: "TWO" },
    ]);
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("validation_error");
    expect(parsed.errors.some((e: string) => e.includes("Row 1"))).toBe(true);
    expect(parsed.errors.some((e: string) => e.includes("Row 2"))).toBe(true);
  });

  // NOTE: xlsx-populateのインポートが重く(5s+)テスト環境でタイムアウトするため、
  // バリデーション通過→テンプレート不在のテストはCI環境またはテンプレート配置済み環境で実行する
  it.skip("should report template not found for valid data when template does not exist", async () => {
    // Provide a fully valid applicant — validation should pass,
    // then fail because the .xlsm template is not in the test environment
    const validApplicant = {
      application_type: "3",
      family_name_romaji: "KABE",
      given_name_romaji: "AKAHIRO",
      nationality_code: "IDN",
      date_of_birth: "19950101",
      sex: "1",
      passport_number: "AB1234567",
      desired_visa_type: "特定技能１号",
      desired_period: "1年",
      company_name: "テスト農園",
      company_address: "北海道札幌市中央区大通1丁目",
      company_phone: "011-111-2222",
      representative: "田中 太郎",
      industry_field_code: "0100",
      work_description: "農作業全般",
      monthly_salary: "200000",
      contract_start_date: "20260401",
    };
    const result = await generateBulkXlsmHandler("3", [validApplicant]);
    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    // Template file won't exist in test environment
    expect(parsed.status).toBe("error");
    expect(parsed.message).toContain("template not found");
  });
});
