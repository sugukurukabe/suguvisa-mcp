import { describe, it, expect } from "vitest";
import { getRequiredDocumentsData } from "../required-documents.js";

describe("required-documents", () => {
  it("should return an error for invalid pattern_id", () => {
    const result = getRequiredDocumentsData({ pattern_id: "INVALID_PATTERN" });
    expect(result).toHaveProperty("status", "error");
    expect((result as any).message).toContain("Pattern ID not found");
  });

  it("should return required documents for CHANGE_SSW1_A (self support, domestic)", () => {
    const result: any = getRequiredDocumentsData({
      pattern_id: "CHANGE_SSW1_A",
      support_type: "self",
      is_domestic: true,
      is_same_employer_2year: false,
    });

    expect(result.status).toBe("ok");
    expect(result.pattern_id).toBe("CHANGE_SSW1_A");
    expect(result.documents.length).toBeGreaterThan(0);

    // Should include Support Docs for 'self'
    const selfSupportDocs = result.documents.filter((d: any) => d.category.includes("支援関連"));
    // Wait, we don't know the exact count, but there should be some docs.
    expect(selfSupportDocs.length).toBeGreaterThan(0);

    // Should include domestic applicant docs
    const domesticDocs = result.documents.filter((d: any) => d.category.includes("国内のみ"));
    expect(domesticDocs.length).toBeGreaterThan(0);
    
    // No documents should be skipped because is_same_employer_2year is false
    expect(result.skipped_count).toBe(0);
  });

  it("should skip skippable documents if same employer within 2 years", () => {
    const result: any = getRequiredDocumentsData({
      pattern_id: "RENEWAL_01",
      support_type: "delegated",
      is_domestic: true,
      is_same_employer_2year: true,
    });

    expect(result.status).toBe("ok");
    // At least some documents should be skipped in renewal with same employer
    expect(result.skipped_count).toBeGreaterThan(0);
    
    const skippedDoc = result.documents.find((d: any) => d.skipped);
    expect(skippedDoc).toBeDefined();
    expect(skippedDoc.skip_reason).toBeDefined();
  });

  it("should omit domestic-only documents for overseas applicants", () => {
    const result: any = getRequiredDocumentsData({
      pattern_id: "GRANT_01",
      support_type: "delegated",
      is_domestic: false, // Application from overseas
    });

    expect(result.status).toBe("ok");
    const domesticDocs = result.documents.filter((d: any) => d.category.includes("国内のみ"));
    // Should be zero for overseas applicants
    expect(domesticDocs.length).toBe(0);
  });

  it("should include field-specific documents and exam info", () => {
    const result: any = getRequiredDocumentsData({
      pattern_id: "CHANGE_SSW1_A",
      industry_field: "農業",
    });

    expect(result.field_specific_count).toBeGreaterThan(0);
    
    const fieldDocs = result.documents.filter((d: any) => d.category.includes("分野固有"));
    expect(fieldDocs.length).toBeGreaterThan(0);
    
    // Exam exemption logic should propagate if defined in pattern
    expect(result.exam_exemption).toBeDefined();
  });
});
