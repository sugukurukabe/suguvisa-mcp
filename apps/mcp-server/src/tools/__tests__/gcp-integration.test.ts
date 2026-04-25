import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { processDocument } from "../../lib/document-ai.js";
import { registerSearchLegalDocs } from "../search-legal-docs.js";

const runGcp = process.env.RUN_GCP_INTEGRATION_TESTS === "1";
const describeGcp = runGcp ? describe : describe.skip;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when RUN_GCP_INTEGRATION_TESTS=1`);
  }
  return value;
}

describeGcp("GCP integration quality gate", () => {
  it("Vertex AI Search env is configured for primary-source legal RAG", () => {
    expect(requiredEnv("GCP_PROJECT_ID")).toBeTruthy();
    expect(process.env.VERTEX_SEARCH_PROJECT_ID ?? process.env.GCP_PROJECT_ID).toBeTruthy();
    expect(requiredEnv("VERTEX_SEARCH_DATA_STORE_ID")).toBeTruthy();
    expect(process.env.VERTEX_SEARCH_LOCATION ?? "global").toBeTruthy();
  });

  it("Document AI processor env is configured without test PII images", () => {
    expect(requiredEnv("DOCUMENT_AI_LOCATION")).toBeTruthy();
    expect(requiredEnv("DOCUMENT_AI_ID_PARSER_ID")).toBeTruthy();
    expect(requiredEnv("DOCUMENT_AI_OCR_PROCESSOR_ID")).toBeTruthy();
    expect(typeof processDocument).toBe("function");
  });

  it("legal search returns primary-source grounding from Vertex AI Search", async () => {
    let handler: (params: Record<string, unknown>) => Promise<unknown> = async () => {
      throw new Error("handler was not registered");
    };
    const mockServer = {
      tool: vi.fn((_name: string, _desc: string, _schema: unknown, opts: unknown, maybeHandler?: unknown) => {
        handler = (typeof opts === "function" ? opts : maybeHandler) as (params: Record<string, unknown>) => Promise<unknown>;
      }),
    } as unknown as McpServer;

    registerSearchLegalDocs(mockServer);
    const result = await handler({
      query: "特定技能 派遣 農業 漁業 受入れ 誓約書",
      max_results: 3,
    });

    const parsed = JSON.parse((result as { content: { text: string }[] }).content[0].text);
    expect(parsed.source).toBe("vertex_ai_search");
    expect(parsed.grounding_level).toBe("primary_source");
    expect(parsed.requires_primary_source_verification).toBe(false);
    expect(parsed.results.length).toBeGreaterThan(0);
  }, 20_000);
});
