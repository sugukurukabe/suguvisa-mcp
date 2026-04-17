# CLAUDE.md

## Repository Purpose

SuguVisa is an MCP server for automating Japanese immigration visa applications.
Customers are immigration lawyers (行政書士), registered support organizations
(登録支援機関), and labor dispatch companies handling foreign workers under
the Specified Skilled Worker (特定技能) visa category.

## Stakes

Errors can affect real people's immigration status. All write operations
that affect official filings MUST require human confirmation.

## Architecture Invariants

- Multi-tenant from day one (every table has tenant_id)
- OAuth 2.1 Resource Server, NOT a static API key server
- Model-agnostic (never import @google/generative-ai or @anthropic-ai/sdk
  outside of packages/llm-router)

## Monorepo Structure

- `apps/mcp-server/` — MCP server (Node.js/TypeScript), the main application
- `packages/` — Shared libraries (auth, core, llm-router, schemas, etc.)
- `infra/` — Terraform / deployment scripts
- `docs/` — Architecture, security, submission documents
- `evals/` — Promptfoo suites, Golden Records, prompts

## 3-Language Rule (3言語ルール)

All comments, documentation, and tool descriptions must be written in
Japanese → English → Bahasa Indonesia, in that order.
Variable/function names are English only (camelCase). File names are kebab-case.

## Do NOT

- Directly modify sugukuru-core / sugukuru-finance / sugukuru-crm / sugukuru-gateway
- Deploy destructive changes to the production Cloud Run (suguvisa-mcp).
  Always deploy as a new revision with --no-traffic for staged rollout.
- Embed real Golden Records data in evaluation code
- Commit API keys (OpenAI / Anthropic / Gemini) to git
- Run npm publish without explicit approval from 壁 (admin)

## Tone for Generated Documents (理由書など)

- 審査官視点で読める敬体
- 根拠条文を明示
- 断定を避け、事実ベースで記述
