#!/usr/bin/env node
import { suguVisaMcpServer } from "./index.js";

const command = process.argv[2] ?? "info";

if (command === "endpoint") {
  process.stdout.write(`${suguVisaMcpServer.mcpEndpoint}\n`);
} else if (command === "json") {
  process.stdout.write(`${JSON.stringify(suguVisaMcpServer, null, 2)}\n`);
} else {
  process.stdout.write(`SuguVisa MCP Server

Endpoint: ${suguVisaMcpServer.mcpEndpoint}
Metadata: ${suguVisaMcpServer.metadataUrl}
OpenAI manifest: ${suguVisaMcpServer.openaiManifestUrl}
Smithery: ${suguVisaMcpServer.smitheryUrl}
Support: ${suguVisaMcpServer.supportEmail}

This npm package is an official locator package only.
It does not include the server implementation, visa rules, Golden Records, templates, or credentials.

Commands:
  suguvisa-mcp info      Show this summary
  suguvisa-mcp endpoint  Print the remote MCP endpoint
  suguvisa-mcp json      Print package metadata as JSON
`);
}
