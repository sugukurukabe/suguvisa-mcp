/**
 * MCP Resources — 公開窓口
 * MCP Resources — barrel file
 * Resource MCP — file barrel
 *
 * 使い方 / Usage:
 *   import { registerAllResources } from "./resources/index.js";
 *   registerAllResources(server, { goldenRecordsStore });
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GoldenRecordStore } from "@suguvisa/golden-records";
import { registerPatternResources } from "./patterns.js";
import { registerIndustryResources } from "./industries.js";
import { registerFormResources } from "./forms.js";
import { registerKnowledgeResources } from "./knowledge.js";
import { registerGoldenRecordResources } from "./golden-records.js";
import { registerOperationResources } from "./operations.js";

export interface RegisterResourcesOptions {
  goldenRecordsStore?: GoldenRecordStore;
}

export function registerAllResources(
  server: McpServer,
  options: RegisterResourcesOptions = {},
): void {
  registerPatternResources(server);
  registerIndustryResources(server);
  registerFormResources(server);
  registerKnowledgeResources(server);
  registerGoldenRecordResources(server, { store: options.goldenRecordsStore });
  registerOperationResources(server);
}

export { registerPatternResources } from "./patterns.js";
export { registerIndustryResources } from "./industries.js";
export { registerFormResources } from "./forms.js";
export { registerKnowledgeResources } from "./knowledge.js";
export { registerGoldenRecordResources } from "./golden-records.js";
export { registerOperationResources } from "./operations.js";
