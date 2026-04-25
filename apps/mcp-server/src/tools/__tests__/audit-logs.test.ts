import { describe, it, expect, vi, beforeEach } from "vitest";
import { logVisaActionHandler } from "../log-visa-action.js";
import { getVisaAuditLogsHandler } from "../get-visa-audit-logs.js";

// Mocking the config and client so tests don't hit the real Supabase
vi.mock("dotenv", () => ({ 
  config: vi.fn() 
}));
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "fake-uuid-123",
            actor: "TestActor",
            action_type: "TEST_ACTION",
            created_at: new Date().toISOString()
          },
          error: null
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({
          data: [{ id: "log-1", actor: "SuguKuru Core" }],
          error: null
        })
      }))
    }))
  };
});

describe("Audit Logs Infrastructure", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  describe("suguvisa_audit_action_log tool", () => {
    it("should return mock success when SUPABASE credentials are missing", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const result = await logVisaActionHandler({
        actor: "AgentSmith",
        action_type: "MOCK_TEST_ACTION"
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse((result.content[0] as any).text);
      expect(content.status).toBe("success_mock");
      expect(content.action_type).toBe("MOCK_TEST_ACTION");
    });

    it("should process the insert when SUPABASE is available", async () => {
      process.env.SUPABASE_URL = "http://fake-url.com";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-key";

      const result = await logVisaActionHandler({
        actor: "TestActor",
        action_type: "TEST_ACTION",
        target_resource: "Tanaka"
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse((result.content[0] as any).text);
      expect(content.status).toBe("success");
      expect(content.log_id).toBe("fake-uuid-123");
    });
  });

  describe("suguvisa_audit_logs_list tool", () => {
    it("should return mock logs when SUPABASE credentials are missing", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const result = await getVisaAuditLogsHandler({
        action_type: "GENERATE_PDF",
        limit: 50
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse((result.content[0] as any).text);
      expect(content.status).toBe("success_mock");
      expect(content.logs[0].action_type).toBe("GENERATE_PDF");
    });

    it("should return the list of logs when SUPABASE is available", async () => {
      process.env.SUPABASE_URL = "http://fake-url.com";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-key";

      const result = await getVisaAuditLogsHandler({
        target_resource: "GILANG",
        limit: 50
      });

      expect(result.isError).toBeUndefined();
      const content = JSON.parse((result.content[0] as any).text);
      expect(content.status).toBe("success");
      expect(content.logs[0].actor).toBe("SuguKuru Core");
    });
  });
});
