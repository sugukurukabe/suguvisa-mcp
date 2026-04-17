import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./src/register-tools.js";

const s = new McpServer({name: "test", version: "1.0"});
registerAllTools(s);
let tools = (s as any)._registeredTools;
tools = Array.from(tools instanceof Map ? tools.values() : Object.values(tools || {}));
console.log("Total tools loaded: " + tools.length);
