import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDetermineApplication } from "../determine-application.js";
import { registerRequiredDocuments } from "../required-documents.js";
import { registerValidateData } from "../validate-data.js";
import { registerTrackSubmissionOutcome } from "../track-submission-outcome.js";

/**
 * 13の全申請パターンに対する MCP ツール・ワークフロー E2E テスト
 * (Determine -> Required Docs -> Validate -> Track Outcome)
 */

type ToolHandler = (params: any) => Promise<any>;

// 全17パターン (13 SSW1 + 4 SSW2)
const ALL_PATTERNS = [
  "GRANT_01",
  "CHANGE_TOKKATSU_A",
  "CHANGE_TOKKATSU_B",
  "CHANGE_TOKKATSU_C",
  "CHANGE_TOKKATSU_D",
  "CHANGE_TOKKATSU_E",
  "CHANGE_SSW1_A",
  "CHANGE_SSW1_B",
  "CHANGE_SSW1_C",
  "CHANGE_SSW1_D",
  "CHANGE_SSW1_E",
  "CHANGE_SSW1_F",
  "RENEWAL_01",
  "GRANT_SSW2",
  "CHANGE_SSW2_A",
  "RENEWAL_SSW2",
  "CHANGE_TOKKATSU_SSW2",
];

// Determine パラメータのモックケース
const DETERMINE_CASES: Record<string, { from: string; to: string; context?: string }> = {
  "GRANT_01": { from: "海外在住", to: "特定技能1号" },
  "CHANGE_TOKKATSU_A": { from: "留学", to: "特定活動" },
  "CHANGE_TOKKATSU_B": { from: "技能実習1号", to: "特定活動" },
  "CHANGE_TOKKATSU_C": { from: "技能実習2号", to: "特定活動" },
  "CHANGE_TOKKATSU_D": { from: "特定技能1号", to: "特定活動" },
  "CHANGE_TOKKATSU_E": { from: "技能実習3号", to: "特定活動" },
  "CHANGE_SSW1_A": { from: "留学", to: "特定技能1号" },
  "CHANGE_SSW1_B": { from: "技能実習1号", to: "特定技能1号" },
  "CHANGE_SSW1_C": { from: "技能実習2号", to: "特定技能1号" },
  "CHANGE_SSW1_D": { from: "特定技能1号", to: "特定技能1号", context: "転職" },
  "CHANGE_SSW1_E": { from: "技能実習3号", to: "特定技能1号" },
  "CHANGE_SSW1_F": { from: "特定活動", to: "特定技能1号" },
  "RENEWAL_01": { from: "特定技能1号", to: "特定技能1号", context: "更新" },
  "GRANT_SSW2": { from: "海外在住", to: "特定技能2号" },
  "CHANGE_SSW2_A": { from: "特定技能1号", to: "特定技能2号" },
  "RENEWAL_SSW2": { from: "特定技能2号", to: "特定技能2号", context: "更新" },
  "CHANGE_TOKKATSU_SSW2": { from: "特定技能1号", to: "特定活動", context: "2号移行準備" },
};

describe("E2E Workflow over all 13 patterns", () => {
  const handlers: Record<string, ToolHandler> = {};

  beforeEach(() => {
    // ローカルモード用
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    const mockServer = {
      tool: vi.fn((name: string, desc: string, schema: any, opts: any, handler: ToolHandler) => {
        // オプション省略時のオーバーロードに対応
        const actualHandler = typeof opts === "function" ? opts : handler;
        handlers[name] = actualHandler;
      }),
    } as unknown as McpServer;

    registerDetermineApplication(mockServer);
    registerRequiredDocuments(mockServer);
    registerValidateData(mockServer);
    registerTrackSubmissionOutcome(mockServer);
  });

  for (const patternId of ALL_PATTERNS) {
    it(`should complete full lifecycle for ${patternId}`, async () => {
      // 1. Determine Application Type (If applicable for this pattern test)
      const determineCase = DETERMINE_CASES[patternId];
      if (determineCase) {
        const detResult = await handlers["determine_application_type"]({
          from_visa: determineCase.from,
          to_visa: determineCase.to,
          context: determineCase.context,
        });
        const detParsed = JSON.parse(detResult.content[0].text);
        expect(detParsed.status).toBe("found");
        expect(detParsed.pattern_id).toBe(patternId);
        expect(detParsed._ai_instructions).toContain("get_required_documents"); // AI instruction check
      }

      // 2. Get Required Documents
      const reqDocsResult = await handlers["get_required_documents"]({
        pattern_id: patternId,
        employment_type: "direct_employment", // Default test value
        industry_field: "agriculture",        // Default test value
      });
      const reqParsed = JSON.parse(reqDocsResult.content[0].text);
      expect(["success", "warning", "ok"]).toContain(reqParsed.status);
      expect(reqParsed.documents.length).toBeGreaterThan(0);
      expect(reqParsed._ai_instructions).toContain("表で表示"); // AI instruction check

      // 3. Track Submission Outcome (Test HITL reporting)
      const trackResult = await handlers["track_submission_outcome"]({
        pattern_id: patternId,
        lookup_key: determineCase ? `${determineCase.from}_${determineCase.to}` : "manual",
        result: "ACCEPTED",
      });
      const trackParsed = JSON.parse(trackResult.content[0].text);
      expect(trackParsed.status).toBe("recorded_locally");
      expect(trackParsed.recorded.pattern_id).toBe(patternId);
      expect(trackParsed._ai_instructions).toContain("🎉"); // AI instruction check
    });
  }
});
