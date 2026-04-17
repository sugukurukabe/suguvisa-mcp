import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./src/register-tools.js";

async function main() {
  const server = new McpServer({
    name: "Test",
    version: "1.0.0"
  });
  registerAllTools(server);
  
  const tools = (server as any)._registeredTools;
  const toolList = Array.from(tools instanceof Map ? tools.values() : Object.values(tools || {}));
  
  toolList.forEach((t: any) => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) {
       console.log("INVALID TOOL NAME: " + t.name);
    }
  });
  console.log("Finished tool name check.");
}

main().catch(console.error);
