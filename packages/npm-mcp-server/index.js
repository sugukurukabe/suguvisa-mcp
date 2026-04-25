import { readFileSync } from "node:fs";

const metadata = JSON.parse(
  readFileSync(new URL("./metadata.json", import.meta.url), "utf8"),
);

export const suguVisaMcpServer = Object.freeze(metadata);

export function getSuguVisaMcpServerInfo() {
  return suguVisaMcpServer;
}

export function getSuguVisaMcpEndpoint() {
  return suguVisaMcpServer.mcpEndpoint;
}
