import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DeterministicEmbeddingProvider,
  GLOBAL_TENANT_ID,
  InMemoryGoldenRecordStore,
} from "@suguvisa/golden-records";
import { registerAllResources } from "../index.js";
import { registerEnhancedPrompts } from "../prompts.js";

type ResourceRead = (uri: URL) => Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}>;

type TemplateRead = (
  uri: URL,
  variables: Record<string, string | string[]>,
) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

interface McpInternals {
  _registeredResources?: Record<string, { readCallback: ResourceRead }>;
  _registeredResourceTemplates?: Record<
    string,
    { readCallback: TemplateRead; resourceTemplate: { uriTemplate: { toString(): string } } }
  >;
  _registeredPrompts?: Record<string, { callback: (args?: Record<string, unknown>) => unknown }>;
}

function resources(server: McpServer) {
  return (server as unknown as McpInternals)._registeredResources ?? {};
}

function templates(server: McpServer) {
  return (server as unknown as McpInternals)._registeredResourceTemplates ?? {};
}

function prompts(server: McpServer) {
  return (server as unknown as McpInternals)._registeredPrompts ?? {};
}

function parseJsonBody(body: { contents: Array<{ text: string }> }): unknown {
  return JSON.parse(body.contents[0]!.text);
}

describe("MCP resources", () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerAllResources(server);
  });

  it("registers core static resources", () => {
    const names = Object.keys(resources(server));
    expect(names).toEqual(
      expect.arrayContaining([
        "suguvisa://patterns/list",
        "suguvisa://industries/list",
        "suguvisa://forms/list",
        "suguvisa://law-updates/latest",
        "suguvisa://deadlines/rules",
        "suguvisa://rules/work-during-application",
        "suguvisa://rules/version",
        "suguvisa://golden-records/registry",
        "suguvisa://golden-records/types",
        "suguvisa://server/info",
        "suguvisa://server/slo",
        "suguvisa://server/changelog",
        "suguvisa://compliance/pii",
      ]),
    );
  });

  it("registers template resources with URI templates", () => {
    const tmpls = templates(server);
    const uriList = Object.values(tmpls).map((t) => t.resourceTemplate.uriTemplate.toString());
    expect(uriList).toEqual(
      expect.arrayContaining([
        "suguvisa://patterns/{id}",
        "suguvisa://industries/{code}",
        "suguvisa://forms/{key}",
      ]),
    );
  });

  it("pattern list returns non-empty array", async () => {
    const cb = resources(server)["suguvisa://patterns/list"]!.readCallback;
    const body = parseJsonBody(await cb(new URL("suguvisa://patterns/list")));
    expect(body).toMatchObject({ total: expect.any(Number) });
    expect((body as { patterns: unknown[] }).patterns.length).toBeGreaterThan(0);
  });

  it("pattern detail returns error for unknown id", async () => {
    const tmpl = findTemplate(server, "suguvisa://patterns/{id}")!;
    const body = parseJsonBody(
      await tmpl.readCallback(new URL("suguvisa://patterns/NO_SUCH"), { id: "NO_SUCH" }),
    );
    expect(body).toMatchObject({ error: "pattern_not_found" });
  });

  it("pattern detail returns the pattern for a real id", async () => {
    const tmpl = findTemplate(server, "suguvisa://patterns/{id}")!;
    const body = parseJsonBody(
      await tmpl.readCallback(new URL("suguvisa://patterns/GRANT_01"), { id: "GRANT_01" }),
    ) as { id?: string };
    expect(body.id).toBe("GRANT_01");
  });

  it("industry detail returns fields for a known code", async () => {
    const tmpl = findTemplate(server, "suguvisa://industries/{code}")!;
    const body = parseJsonBody(
      await tmpl.readCallback(new URL("suguvisa://industries/01"), { code: "01" }),
    ) as { code?: string; name?: string };
    expect(body.code).toBe("01");
    expect(body.name).toBe("農業");
  });

  it("form detail returns proper error for missing key", async () => {
    const tmpl = findTemplate(server, "suguvisa://forms/{key}")!;
    const body = parseJsonBody(
      await tmpl.readCallback(new URL("suguvisa://forms/does-not-exist"), {
        key: "does-not-exist",
      }),
    );
    expect(body).toMatchObject({ error: "form_not_found" });
  });

  it("operations: server_slo exposes SLA levels per plan", async () => {
    const body = parseJsonBody(
      await resources(server)["suguvisa://server/slo"]!.readCallback(
        new URL("suguvisa://server/slo"),
      ),
    ) as { support: Record<string, string> };
    expect(Object.keys(body.support)).toEqual(
      expect.arrayContaining(["Free", "Standard", "Enterprise"]),
    );
  });

  it("pii_policy is markdown", async () => {
    const result = await resources(server)["suguvisa://compliance/pii"]!.readCallback(
      new URL("suguvisa://compliance/pii"),
    );
    expect(result.contents[0]!.mimeType).toBe("text/markdown");
    expect(result.contents[0]!.text).toContain("PII 取扱いポリシー");
  });
});

function findTemplate(
  server: McpServer,
  uriTemplate: string,
): { readCallback: TemplateRead } | undefined {
  const tmpls = (server as unknown as McpInternals)._registeredResourceTemplates ?? {};
  return Object.values(tmpls).find(
    (t) => t.resourceTemplate.uriTemplate.toString() === uriTemplate,
  );
}

describe("Golden Records template resource", () => {
  it("is only registered when a store is provided", async () => {
    const withoutStore = new McpServer({ name: "test", version: "0.0.0" });
    registerAllResources(withoutStore);
    expect(Object.keys(templates(withoutStore))).not.toContain("golden_records_by_type");

    const withStore = new McpServer({ name: "test", version: "0.0.0" });
    const store = new InMemoryGoldenRecordStore();
    registerAllResources(withStore, { goldenRecordsStore: store });
    const tmplUris = Object.values(templates(withStore)).map((t) =>
      t.resourceTemplate.uriTemplate.toString(),
    );
    expect(tmplUris).toContain("suguvisa://golden-records/{type}");

    // Seed and read
    await store.create({
      tenantId: GLOBAL_TENANT_ID,
      type: "visa_rule",
      title: "t",
      summary: "s",
      content: "c",
      source: { name: "x" },
      citations: [],
      validFrom: "2020-01-01T00:00:00.000Z",
      validUntil: null,
      metadata: {},
    });
    new DeterministicEmbeddingProvider(64); // ensure no import-side-effect regressions
    const goldenTmpl = findTemplate(withStore, "suguvisa://golden-records/{type}")!;
    const body = parseJsonBody(
      await goldenTmpl.readCallback(new URL("suguvisa://golden-records/visa_rule"), {
        type: "visa_rule",
      }),
    ) as { total: number };
    expect(body.total).toBeGreaterThan(0);
  });
});

describe("Enhanced prompts", () => {
  it("exposes all new prompt templates", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerEnhancedPrompts(server);
    expect(Object.keys(prompts(server))).toEqual(
      expect.arrayContaining([
        "citation_based_answer",
        "ssw2_field_eligibility",
        "weekly_visa_status_review",
        "pre_submission_final_check",
        "incident_triage",
        "onboarding_new_tenant",
      ]),
    );
  });

  it("citation_based_answer builds a user message with the question", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerEnhancedPrompts(server);
    const p = prompts(server).citation_based_answer!;
    const result = (await p.callback({ question: "更新申請の期限は？" })) as {
      messages: Array<{ content: { text: string } }>;
    };
    expect(result.messages[0]!.content.text).toContain("更新申請の期限は？");
    expect(result.messages[0]!.content.text).toContain("search_golden_records");
  });

  it("pre_submission_final_check adapts to paper vs online", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerEnhancedPrompts(server);
    const p = prompts(server).pre_submission_final_check!;
    const paper = (await p.callback({
      pattern_id: "CHANGE_SSW1_C",
      submission_mode: "paper",
    })) as { messages: Array<{ content: { text: string } }> };
    expect(paper.messages[0]!.content.text).toContain("generate_paper_form");
    const online = (await p.callback({
      pattern_id: "CHANGE_SSW1_C",
      submission_mode: "online",
    })) as { messages: Array<{ content: { text: string } }> };
    expect(online.messages[0]!.content.text).toContain("generate_bulk_xlsm");
  });
});
