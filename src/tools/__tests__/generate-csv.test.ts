import { describe, it, expect } from "vitest";
import { officialCsvSchema, parseDateString } from "../../data/csv-schema.js";

describe("Official CSV Schema Validation", () => {
  it("should normalize natural language dates to YYYYMMDD", () => {
    expect(parseDateString("2000年7月7日")).toBe("20000707");
    expect(parseDateString("1995-12-15")).toBe("19951215");
    expect(parseDateString("2025/04/01")).toBe("20250401");
  });

  it("should validate a complete valid applicant record", () => {
    const applicant = {
      application_type: "3", // 変更 (Change)
      family_name_romaji: "KABE",
      given_name_romaji: "AKAHIRO",
      nationality_code: "CHN",
      date_of_birth: "2000年7月7日", // Will be transformed
      sex: "1", // 男
      passport_number: "G12345678",
      desired_visa_type: "特定技能１号",
      desired_period: "1年",
      company_name: "青空農園",
      company_address: "北海道札幌市",
      company_phone: "011-123-4567",
      representative: "青木 一郎",
      industry_field_code: "0100", // 農業
      work_description: "農作業全般",
      monthly_salary: "1000円", // Will be transformed
      contract_start_date: "2026年5月1日", // Will be transformed
    };

    const parsed = officialCsvSchema.safeParse(applicant);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.date_of_birth).toBe("20000707");
      expect(parsed.data.monthly_salary).toBe("1000");
      expect(parsed.data.contract_start_date).toBe("20260501");
    }
  });

  it("should fail validation if required fields are missing", () => {
    const incompleteApplicant = {
      family_name_romaji: "KABE",
      // missing given_name, application_type, date_of_birth, etc.
    };

    const parsed = officialCsvSchema.safeParse(incompleteApplicant);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("application_type");
      expect(paths).toContain("given_name_romaji");
      expect(paths).toContain("date_of_birth");
    }
  });

  it("should fail validation if corporate number is invalid length", () => {
    const applicant = {
      application_type: "1",
      family_name_romaji: "TEST",
      given_name_romaji: "USER",
      nationality_code: "IDN",
      date_of_birth: "19900101",
      sex: "1",
      passport_number: "AA112233",
      desired_visa_type: "特定技能１号",
      desired_period: "1年",
      company_name: "テスト会社",
      corporate_number: "123", // Invalid length, must be 13 digits
      industry_field_code: "0100",
      work_description: "作業",
      monthly_salary: "200000",
      contract_start_date: "20260101",
      company_address: "東京都",
      company_phone: "03-0000-0000",
      representative: "代表",
    };

    const parsed = officialCsvSchema.safeParse(applicant);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("法人番号は13桁");
    }
  });
});
