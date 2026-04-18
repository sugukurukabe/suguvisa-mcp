#!/usr/bin/env node
/**
 * @suguvisa/billing CLI
 *
 *   suguvisa-billing seed   [--key sk_test_...] [--dry-run] [--allow-live]
 *   suguvisa-billing verify [--url https://mcp.suguvisa.com] [--stripe-key sk_test_...]
 */
import { runCli as runSeedCli } from "./seed.js";
import { runVerifyCli } from "./verify.js";

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  let exit = 0;
  switch (cmd) {
    case "seed":
      exit = await runSeedCli(rest);
      break;
    case "verify":
      exit = await runVerifyCli(rest);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(
        [
          "suguvisa-billing — SuguVisa Stripe management CLI",
          "",
          "commands:",
          "  seed   [--key sk_test_...] [--dry-run] [--allow-live]",
          "         Idempotently create/refresh Stripe products + prices for every",
          "         publicly-listed paid plan. Reuses existing records by lookup_key.",
          "",
          "  verify [--url https://mcp.suguvisa.com] [--stripe-key sk_test_...]",
          "         Probe the deployed MCP server and confirm billing is fully wired.",
          "",
          "example:",
          "  export STRIPE_SECRET_KEY=sk_test_xxx",
          "  pnpm --filter @suguvisa/billing build",
          "  node packages/billing/dist/cli.js seed --dry-run",
          "  node packages/billing/dist/cli.js seed",
            "  node packages/billing/dist/cli.js verify --url https://mcp.suguvisa.com",
        ].join("\n"),
      );
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      exit = 1;
  }
  process.exit(exit);
}

void main();
