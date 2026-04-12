import { describe, it, expect } from "vitest";
import { generateAnnualReportCsvHandler } from "../generate-annual-report-csv.js";

describe("generate_annual_report_csv tool", () => {
  it("should successfully generate both CSV and paper formats for valid data", async () => {
    const response = await generateAnnualReportCsvHandler([
      {
        residence_card_number: "AB12345678CD",
        family_name_romaji: "TANAKA",
        given_name_romaji: "TARO",
        date_of_birth: "19900101",
        sex: "1",
        working_days: "240",
        paid_leave_days: "5",
        monthly_salary_average: "250000",
        support_interview_date: "20251210",
        support_status_code: "1"
      }
    ]);

    const result = JSON.parse((response.content[0] as any).text);
    
    expect(result.status).toBe("ok");
    expect(result.report_count).toBe(1);
    
    // Ensure paper_form_data is generated
    expect(result.paper_form_data).toBeDefined();
    expect(result.paper_form_data[0].family_name_romaji).toBe("TANAKA");
    expect(result.paper_form_data[0].monthly_salary_average).toBe("250000");

    // Ensure csv_content is generated and contains the header and the data row
    expect(result.csv_content).toContain("residence_card_number");
    expect(result.csv_content).toContain("AB12345678CD");
  });

  it("should return validation errors for missing required fields", async () => {
    const response = await generateAnnualReportCsvHandler([
      {
        // Missing family_name_romaji and working_days
        residence_card_number: "AB12345678CD",
        given_name_romaji: "TARO",
        date_of_birth: "19900101",
        sex: "1",
        paid_leave_days: "5",
        monthly_salary_average: "250000"
      }
    ]);

    const result = JSON.parse((response.content[0] as any).text);
    
    expect(result.status).toBe("missing_fields_or_validation_error");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("family_name_romaji");
    expect(result.errors[0]).toContain("working_days");
  });
});

