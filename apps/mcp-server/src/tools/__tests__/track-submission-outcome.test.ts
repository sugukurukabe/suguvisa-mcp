import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * suguvisa_submission_outcome_track ツールのユニットテスト
 * Unit tests for suguvisa_submission_outcome_track tool
 * Unit test untuk alat suguvisa_submission_outcome_track
 *
 * Supabase未設定の場合のローカルモードとバリデーションをテスト
 */

// register-tools を通じてサーバーにツールを登録し、
// tool.call() でツールを直接テストする
let toolHandler: (params: Record<string, unknown>) => Promise<unknown>;

beforeEach(async () => {
  // Supabase環境変数をクリア（ローカルモードでテスト）
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;

  // 動的インポートでモジュールキャッシュを回避
  const mod = await import("../track-submission-outcome.js");

  // McpServerをモックしてツールハンドラをキャプチャ
  const mockServer = {
    tool: vi.fn((_name: string, _desc: string, _schema: unknown, _opts: unknown, handler: unknown) => {
      toolHandler = handler as (params: Record<string, unknown>) => Promise<unknown>;
    }),
  } as unknown as McpServer;

  mod.registerTrackSubmissionOutcome(mockServer);
});

describe("suguvisa_submission_outcome_track", () => {
  it("should register the tool with the server", () => {
    expect(toolHandler).toBeDefined();
  });

  it("should reject invalid pattern_id", async () => {
    const result = await toolHandler({
      pattern_id: "INVALID_PATTERN",
      lookup_key: "test_key",
      result: "ACCEPTED",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("error");
    expect(parsed.message).toContain("無効な pattern_id");
    expect(parsed._ai_instructions).toContain("suguvisa_application_type_determine");
  });

  it("should accept valid CHANGE_SSW1_C pattern with ACCEPTED result (local mode)", async () => {
    const result = await toolHandler({
      pattern_id: "CHANGE_SSW1_C",
      lookup_key: "技能実習2号_特定技能1号",
      result: "ACCEPTED",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("recorded_locally");
    expect(parsed.recorded.pattern_id).toBe("CHANGE_SSW1_C");
    expect(parsed.recorded.result).toBe("ACCEPTED");
    expect(parsed._ai_instructions).toContain("🎉");
    expect(parsed._ai_instructions).toContain("在留カード");
  });

  it("should return revision guidance for REVISION_REQUIRED result", async () => {
    const result = await toolHandler({
      pattern_id: "CHANGE_SSW1_A",
      lookup_key: "留学_特定技能1号",
      result: "REVISION_REQUIRED",
      revision_codes: ["MISSING_DOC_001", "FORMAT_ERR_003"],
      revision_details: "雇用条件書の賃金記載が最低賃金を下回っています",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("recorded_locally");
    expect(parsed.recorded.result).toBe("REVISION_REQUIRED");
    expect(parsed.recorded.revision_codes).toContain("MISSING_DOC_001");
    expect(parsed._ai_instructions).toContain("⚠️ 補正が指示されました");
  });

  it("should return rejection guidance for REJECTED result", async () => {
    const result = await toolHandler({
      pattern_id: "RENEWAL_01",
      lookup_key: "特定技能1号_特定技能1号_更新",
      result: "REJECTED",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("recorded_locally");
    expect(parsed.recorded.result).toBe("REJECTED");
    expect(parsed._ai_instructions).toContain("❌");
    expect(parsed._ai_instructions).toContain("特定行政書士");
  });

  it("should accept all valid pattern IDs", async () => {
    const validPatterns = [
      "GRANT_01",
      "CHANGE_TOKKATSU_A", "CHANGE_TOKKATSU_B", "CHANGE_TOKKATSU_C",
      "CHANGE_TOKKATSU_D", "CHANGE_TOKKATSU_E",
      "CHANGE_SSW1_A", "CHANGE_SSW1_B", "CHANGE_SSW1_C",
      "CHANGE_SSW1_D", "CHANGE_SSW1_E", "CHANGE_SSW1_F",
      "RENEWAL_01",
    ];

    for (const patternId of validPatterns) {
      const result = await toolHandler({
        pattern_id: patternId,
        lookup_key: "test_key",
        result: "ACCEPTED",
      });

      const parsed = JSON.parse(
        (result as { content: { text: string }[] }).content[0].text
      );
      expect(parsed.status).toBe("recorded_locally");
      expect(parsed.recorded.pattern_id).toBe(patternId);
    }
  });

  it("should include Supabase setup message in local mode", async () => {
    const result = await toolHandler({
      pattern_id: "CHANGE_SSW1_C",
      lookup_key: "技能実習2号_特定技能1号",
      result: "ACCEPTED",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.message).toContain("Supabase未設定");
    expect(parsed.message_en).toContain("SUPABASE_URL");
  });

  it("should handle optional fields gracefully", async () => {
    const result = await toolHandler({
      pattern_id: "CHANGE_SSW1_C",
      lookup_key: "技能実習2号_特定技能1号",
      result: "REVISION_REQUIRED",
      // all optional fields omitted
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("recorded_locally");
    expect(parsed.recorded.revision_codes).toEqual([]);
  });
});
