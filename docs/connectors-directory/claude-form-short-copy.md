# Claude Directory Short Copy / Claude Directory 短縮版 / Salinan Singkat Claude Directory

フォームの文字数制限に入らない場合の貼り付け用短縮版。
Short copy for Claude Directory form fields when the full draft is too long.
Salinan singkat untuk kolom formulir Claude Directory saat draf lengkap terlalu panjang.

詳細版 / Full draft / Draf lengkap: `docs/connectors-directory/claude-form-draft.md`

---

## 使い方 / How To Use / Cara Pakai

日本語: フォームにはこの短縮版を貼り、詳しい根拠は公開URLに誘導する。
English: Paste this short version into the form and use public URLs for detailed evidence.
Bahasa Indonesia: Tempel versi singkat ini ke formulir dan gunakan URL publik untuk bukti detail.

機密情報注意 / Sensitive information note / Catatan informasi sensitif:
Do not paste reviewer bearer tokens into public or semi-public text fields. Provide test credentials privately by email if Anthropic requests them.

---

## Server Name

```text
SuguVisa
```

## Server URL

```text
https://mcp.suguvisa.com/mcp
```

## Tagline

```text
Japan Specified Skilled Worker visa automation
```

## Description (Short)

```text
SuguVisa is a business-grade AI connector for Japan's Specified Skilled Worker (SSW / 特定技能) visa workflows. It provides 42 MCP tools, 14 prompts, and 70 resources for application-pattern detection, document checklists, deadlines, OCR, annual reports, paper-form mapping, law-change tracking, and audit logs. Built for immigration lawyers, support organizations, receiving companies, dispatching-company staff, dispatch-client contacts, and applicants.
```

## Description (Very Short)

```text
SuguVisa automates Japan's Specified Skilled Worker visa workflows for immigration lawyers, support organizations, receiving companies, dispatching-company staff, dispatch-client contacts, and applicants. It covers classification, document checklists, deadlines, OCR, official forms, law updates, and audit logs.
```

## Use Cases

```text
1. Technical Intern 2号 to SSW-1 change-of-status: SuguVisa detects the application pattern, applies exam-exemption logic, lists required documents, and calculates the filing timeline.

2. Annual periodic notification: SuguVisa validates staff data, checks wage and contract consistency, and generates Immigration Services Agency CSV/Excel output.

3. Residence-card OCR and deadline planning: SuguVisa extracts residence-card fields, discards image data after OCR, and calculates renewal or 14-day notification deadlines.

4. Final pre-submission check: SuguVisa verifies required documents, furigana format, corporate number length, wage rules, jurisdictional immigration office, and paper/online output readiness.
```

## Connection Requirements

```text
Free tier available with no credit card required. Continued use is available through a 30-day ticket or monthly plans. Accounts are provisioned through OAuth 2.1 with Dynamic Client Registration on first connection from Claude; no manual API key setup is required for normal Directory users. Japanese and English are supported. Production runs in asia-northeast1 (Tokyo).
```

## Read / Write Capabilities

```text
Read + Write. SuguVisa reads visa rules, document requirements, case metadata, and law-change resources. It writes generated outputs, submission outcomes, audit logs, and tenant-scoped workflow records. It does not transfer money, cryptocurrency, or execute financial transactions, and it does not provide cross-service automation.
```

## Public Documentation Links

```text
Production MCP endpoint: https://mcp.suguvisa.com/mcp
Landing page: https://mcp.suguvisa.com/
Setup and troubleshooting: https://mcp.suguvisa.com/support
Privacy policy: https://mcp.suguvisa.com/privacy
Terms of service: https://mcp.suguvisa.com/terms
Server card: https://mcp.suguvisa.com/.well-known/mcp/server-card.json
OAuth protected resource metadata: https://mcp.suguvisa.com/.well-known/oauth-protected-resource
OAuth authorization server metadata: https://mcp.suguvisa.com/.well-known/oauth-authorization-server
Official npm locator: https://www.npmjs.com/package/@suguvisa/mcp-server
Smithery listing: https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp
Company website: https://sugu-kuru.co.jp/
Support email: info@sugu-kuru.co.jp
```

## Promotional Images

```text
Use these two real screenshots as the primary uploads if the form has limited upload slots:

1. https://mcp.suguvisa.com/assets/screenshot-4.png
   Real Claude result from SuguVisa: law-change tracking and latest Specified Skilled Worker immigration-rule updates, sorted by date with source links.

2. https://mcp.suguvisa.com/assets/primary-screenshot-2-oauth-consent.png
   Real OAuth 2.1 consent screen with scoped permissions.

If screenshot-4 is too small in the form preview, use the readable crop instead:
https://mcp.suguvisa.com/assets/primary-screenshot-1-law-updates.png

Supplemental real screenshots: /assets/screenshot-3.png and /assets/screenshot-5.png.
Readable explanatory graphics: /assets/review-screenshot-1.png and /assets/review-screenshot-2.png.
```

## Tools Summary

```text
SuguVisa exposes 42 tools. All tools use official-style snake_case names with the suguvisa_ namespace and include title, readOnlyHint, and destructiveHint annotations. Tool categories include application classification, required documents, deadlines, OCR, annual reports, paper/online form generation, SSW2 checklists, law updates, golden-record search, audit logging, tenant operations, and support workflows.

Full machine-readable tool schemas are available at:
https://mcp.suguvisa.com/.well-known/mcp/server-card.json
```

## Prompts Summary

```text
SuguVisa exposes 14 prompts, all using the suguvisa_ namespace. Examples include suguvisa_titp_to_ssw1_workflow, suguvisa_job_change_checklist, suguvisa_residence_card_verify, suguvisa_pre_submission_final_check, suguvisa_citation_answer_generate, and suguvisa_tenant_onboarding.

Full prompt list is maintained in the public server card and internal submission draft.
```

## Resources Summary

```text
SuguVisa exposes 70 resources under the suguvisa:// URI scheme. They cover application patterns, SSW industry fields, reference forms, deadline rules, work-during-application rules, law updates, rule-set versions, golden records, server metadata, SLO, changelog, and PII policy.

Examples: suguvisa://patterns/list, suguvisa://patterns/{id}, suguvisa://industries/list, suguvisa://forms/{key}, suguvisa://deadlines/rules, suguvisa://golden-records/registry, suguvisa://server/info, suguvisa://compliance/pii.
```

## Test Account Access

```text
Production endpoint is used for review: https://mcp.suguvisa.com/mcp

Anthropic reviewers can test either through the normal OAuth 2.1 flow or with a reviewer-only bearer token provided privately on request. The reviewer tenant is isolated from real customer data and can be granted professional-plan access for review.

Quick test:
1. Open MCP Inspector.
2. Connect to https://mcp.suguvisa.com/mcp using Streamable HTTP.
3. Authenticate through OAuth, or request a private reviewer bearer token from info@sugu-kuru.co.jp.
4. Verify that tools/list returns 42 tools, prompts/list returns 14 prompts, and resources/list returns 70 resources.
```

## Checklist Summary

```text
SuguVisa is live in production and ready for review. OAuth 2.1 + PKCE + Dynamic Client Registration is implemented. HTTPS and CORS are configured. All 42 tools include safety annotations. Documentation, setup instructions, troubleshooting, privacy policy, terms, server card, and OAuth metadata are public. The server does not enable cross-service automation and does not transfer money or cryptocurrency. SugukuruCo., Ltd owns and controls the relevant domains, endpoint, cloud project, Auth0 tenant, and backend systems.
```

## Additional Information (Short)

```text
SugukuruCo., Ltd is a rural Kagoshima company that dispatches and supports foreign workers in Japanese agriculture. We built SuguVisa from our own daily visa, notification, renewal, housing, payroll, and worker-support operations. Japan's immigration paperwork is complex and time-sensitive; too much support staff time is consumed by forms instead of helping foreign workers live and work well. SuguVisa is our attempt to move that burden into correct, auditable automation so people can focus on people.

Claude and MCP made it possible for a small rural Japanese company to build a production AI product in a field where deep domain experience matters more than company size. We are grateful for that opportunity and will keep improving SuguVisa through real cases, golden records, tests, and daily operational feedback.
```

## If The Form Has A "More Details" Field

```text
For full details, please see the public documentation and machine-readable metadata:

- Setup and troubleshooting: https://mcp.suguvisa.com/support
- Server card with complete tool schemas and annotations: https://mcp.suguvisa.com/.well-known/mcp/server-card.json
- OAuth metadata: https://mcp.suguvisa.com/.well-known/oauth-authorization-server
- Protected resource metadata: https://mcp.suguvisa.com/.well-known/oauth-protected-resource
- Privacy: https://mcp.suguvisa.com/privacy
- Terms: https://mcp.suguvisa.com/terms
- Official npm locator: https://www.npmjs.com/package/@suguvisa/mcp-server
- Smithery listing: https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp
```
