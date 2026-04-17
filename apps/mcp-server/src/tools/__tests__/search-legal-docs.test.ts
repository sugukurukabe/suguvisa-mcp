import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * search_legal_docs ツールのユニットテスト（モックモード）
 * Unit tests for search_legal_docs tool (mock mode)
 * Unit test untuk alat search_legal_docs (mode mock)
 *
 * GCP認証情報なしでモックフォールバック動作をテスト
 */
let toolHandler: (params: Record<string, unknown>) => Promise<unknown>;

beforeEach(async () => {
  // GCP環境変数をクリア → モックモードで動作させる
  delete process.env.VERTEX_SEARCH_PROJECT_ID;
  delete process.env.GCP_PROJECT_ID;
  delete process.env.VERTEX_SEARCH_DATA_STORE_ID;

  const mod = await import("../search-legal-docs.js");

  const mockServer = {
    tool: vi.fn((_name: string, _desc: string, _schema: unknown, opts: unknown, handler?: unknown) => {
      const actualHandler = typeof opts === "function" ? opts : handler;
      toolHandler = actualHandler as (params: Record<string, unknown>) => Promise<unknown>;
    }),
  } as unknown as McpServer;

  mod.registerSearchLegalDocs(mockServer);
});

describe("search_legal_docs (mock mode)", () => {
  it("should register the tool", () => {
    expect(toolHandler).toBeDefined();
  });

  it("should return mock_success when GCP is not configured", async () => {
    const result = await toolHandler({
      query: "特定技能1号 農業 必要書類",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    expect(parsed.status).toBe("fallback");
    expect(parsed.message).toContain("組み込みの基本知識から回答します。");
    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it("should return mock results with title, snippet, and link", async () => {
    const result = await toolHandler({
      query: "派遣契約",
    });

    const parsed = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    );
    const firstResult = parsed.results[0];
    expect(firstResult).toHaveProperty("title");
    expect(firstResult).toHaveProperty("snippet");
    expect(firstResult).toHaveProperty("link");
    expect(firstResult.title.length).toBeGreaterThan(0);
    expect(firstResult.snippet.length).toBeGreaterThan(0);
  });
});
