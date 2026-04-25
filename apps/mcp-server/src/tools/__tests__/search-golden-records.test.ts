import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DeterministicEmbeddingProvider,
  HybridRetriever,
  InMemoryGoldenRecordStore,
  GLOBAL_TENANT_ID,
} from "@suguvisa/golden-records";
import {
  registerSearchGoldenRecords,
  setGoldenRecordsContext,
} from "../search-golden-records.js";

/**
 * McpServer の内部から tool handler を取り出すためのヘルパ
 * Helper to access the registered tool handler from McpServer internals
 * Helper untuk mengakses handler tool yang terdaftar dari internal McpServer
 */
type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }> }>;

function getTool(server: McpServer, name: string): { handler: ToolHandler } {
  const anyServer = server as unknown as {
    _registeredTools?: Record<string, { handler: ToolHandler }>;
  };
  const tools = anyServer._registeredTools;
  if (!tools || !tools[name]) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return tools[name];
}

describe("suguvisa_golden_records_search MCP tool", () => {
  let store: InMemoryGoldenRecordStore;

  beforeEach(async () => {
    store = new InMemoryGoldenRecordStore();
    const embeddings = new DeterministicEmbeddingProvider(128);
    const retriever = new HybridRetriever({ store, embeddings });
    setGoldenRecordsContext({ store, retriever });

    await store.create({
      tenantId: GLOBAL_TENANT_ID,
      type: "visa_rule",
      title: "特定技能 1 号 技能試験免除",
      summary: "技能実習 2 号を良好に修了した場合は試験免除",
      content: "技能実習 2 号を良好に修了した場合、技能試験と日本語試験が免除される。",
      source: { name: "入管庁 FAQ", url: "https://example.gov/faq" },
      citations: [],
      validFrom: "2020-04-01T00:00:00.000Z",
      validUntil: null,
      metadata: {},
    });
    await store.create({
      tenantId: "tenant-A",
      type: "case_precedent",
      title: "農業分野 転職の補正事例",
      summary: "農業分野での転職で追加書類を求められた事例",
      content: "2024 年 8 月 / 農業分野。雇用契約書の押印が必要と指摘された。",
      source: { name: "社内事例集" },
      citations: [],
      validFrom: "2024-08-01T00:00:00.000Z",
      validUntil: null,
      metadata: {},
    });
  });

  afterEach(() => {
    setGoldenRecordsContext(undefined);
  });

  it("returns structured results with citations and prompt context", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSearchGoldenRecords(server);
    const tool = getTool(server, "suguvisa_golden_records_search");

    const res = await tool.handler({ query: "試験免除", topK: 3 });
    const payload = JSON.parse(res.content[0]!.text);

    expect(payload.status).toBe("success");
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.results[0].title).toContain("試験免除");
    expect(payload.prompt_context).toContain("試験免除");
    expect(payload._ai_instructions).toContain("引用");
  });

  it("respects tenant filter with include_global default true", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSearchGoldenRecords(server);
    const tool = getTool(server, "suguvisa_golden_records_search");

    const res = await tool.handler({ query: "農業 転職", tenant_id: "tenant-A" });
    const payload = JSON.parse(res.content[0]!.text);
    const titles: string[] = payload.results.map((r: { title: string }) => r.title);
    expect(titles.some((t) => t.includes("農業分野"))).toBe(true);
  });

  it("excludes other tenants data", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSearchGoldenRecords(server);
    const tool = getTool(server, "suguvisa_golden_records_search");

    const res = await tool.handler({
      query: "農業 転職",
      tenant_id: "tenant-B",
      include_global: false,
    });
    const payload = JSON.parse(res.content[0]!.text);
    expect(payload.count).toBe(0);
  });

  it("filters by types", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSearchGoldenRecords(server);
    const tool = getTool(server, "suguvisa_golden_records_search");

    const res = await tool.handler({
      query: "特定技能 農業",
      tenant_id: "tenant-A",
      include_global: true,
      types: ["visa_rule"],
    });
    const payload = JSON.parse(res.content[0]!.text);
    for (const r of payload.results) {
      expect(r.type).toBe("visa_rule");
    }
  });
});
