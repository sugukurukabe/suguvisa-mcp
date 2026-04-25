import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPeriodicNotificationChecker } from "../periodic-notification-checker.js";
import { registerAnalyzeSupportRecords } from "../analyze-support-records.js";
import { registerGeneratePeriodicNotification } from "../generate-periodic-notification.js";

// Mocking GCP AI interactions to prevent actual API calls during text
vi.mock("../../lib/vertex-ai.js", () => ({
  generateWithImage: vi.fn().mockImplementation(async (prompt, imageBase64, mimeType) => {
    // If it's the mock for failure
    if (imageBase64 === "BAD_BASE64") {
      throw new Error("Invalid image format or API error");
    }
    // Return standard mock response matching the JSON schema
    return JSON.stringify({
      is_compliant: true,
      total_working_hours: 160,
      overtime_hours: 10,
      base_salary: 200000,
      deductions: 40000,
      findings: ["全ての基準を満たしています。"]
    });
  })
}));

type ToolHandler = (params: any) => Promise<any>;

describe("Periodic Notification Tools", () => {
  const handlers: Record<string, ToolHandler> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    const mockServer = {
      tool: vi.fn((name: string, desc: string, schema: any, opts: any, handler: ToolHandler) => {
        // Options may be omitted
        const actualHandler = typeof opts === "function" ? opts : handler;
        handlers[name] = actualHandler;
      }),
    } as unknown as McpServer;

    registerPeriodicNotificationChecker(mockServer);
    registerAnalyzeSupportRecords(mockServer);
    registerGeneratePeriodicNotification(mockServer);
  });

  describe("suguvisa_periodic_notification_requirements_check", () => {
    it("should return extra documents when support is self-managed and not good standing", async () => {
      const result = await handlers["suguvisa_periodic_notification_requirements_check"]({
        company_name: "テスト農園",
        is_delegated: false,
        has_good_standing: false,
        has_middle_resignation: false,
        has_rest_period: false
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("success");
      // expects base doc + self support doc + wage ledger + attendance = 4 documents
      expect(parsed.documents).toHaveLength(4);
      expect(parsed.documents.find((d: any) => d.id === "doc-1")).toBeDefined();
      expect(parsed.documents.find((d: any) => d.id === "doc-2")).toBeDefined();
    });

    it("should return base document only if delegated and has good standing", async () => {
      const result = await handlers["suguvisa_periodic_notification_requirements_check"]({
        company_name: "優良企業株式会社",
        is_delegated: true,
        has_good_standing: true,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("success");
      expect(parsed.documents).toHaveLength(1); // Only doc-1
      expect(parsed.documents[0].id).toBe("doc-1");
    });
  });

  describe("suguvisa_support_records_analyze", () => {
    it("should call mock vertex AI and return compliance audit", async () => {
      const result = await handlers["suguvisa_support_records_analyze"]({
        file_base64: "dGVzdC1iYXNlNjQ=",
        mime_type: "application/pdf",
        document_type: "wage_ledger",
        expected_base_salary: 200000
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("success");
      // JSON contains 'auditResult', rather than 'document_type' at top level
      expect(parsed.auditResult.is_compliant).toBe(true);
      expect(parsed.auditResult.base_salary).toBe(200000);
    });

    it("should handle error thrown by Vertex AI gracefully", async () => {
      const result = await handlers["suguvisa_support_records_analyze"]({
        file_base64: "BAD_BASE64",
        mime_type: "image/jpeg",
        document_type: "attendance_record"
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("error");
      // The error message from mock vertex AI logic
      expect(parsed.message).toContain("Invalid image format or API error");
    });
  });

  describe("suguvisa_periodic_notification_forms_generate", () => {
    it("should output download URLs and simulated success", async () => {
      const records = [
        { name: "TANAKA", residence_card_number: "AA123", total_working_hours: 100, total_payment: 1000, status: "active" as const }
      ];

      const result = await handlers["suguvisa_periodic_notification_forms_generate"]({
        company_name: "自動生成テスト",
        reporting_year: 2025,
        output_format: "excel",
        workers_data: records
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("success");
      expect(parsed.file_path).toContain(".xlsx");
    });
  });
});
