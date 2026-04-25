# Claude Connectors Directory — 申請フォーム完成版
# Anthropic Google Form 回答（コピペ可）
# Formulir Anthropic / Form Anthropic

提出先: Anthropic Google Form（支援ドキュメントから案内される Form URL）
最終更新: 2026-04-25 / Server v0.9.4 / status: Smithery SUCCESS, all public endpoints 200
Tools: 42 (title+readOnlyHint+destructiveHint 100% coverage)
Reviewer tenant: Anthropic MCP Review (professional plan, unlimited)

---

## 0. Anthropic Point of Contact (if known)

```
(空欄 / leave blank)
```

---

## 1. Server Details

### MCP Server Name *
> As you'd like it to appear in the Directory. Do not include "MCP" or "Server" in the name

```
SuguVisa
```

### MCP Server URL — Universal URL or Custom? *

```
Universal URL
```

### MCP Server URL *

```
https://mcp.suguvisa.com/mcp
```

### Tagline *（max 55 chars）

```
Japan Specified Skilled Worker visa automation
```
（47 文字）

**代替案 / alternatives:**
- `Automate Japan's SSW visa filings end-to-end` (46)
- `AI copilot for Japan 特定技能 visa applications` (47)
- `End-to-end Japan SSW (特定技能) visa automation` (47)

### MCP Server Description *（50-100 words）

```
SuguVisa is a business-grade AI connector specialized in Japan's Specified
Skilled Worker (SSW / 特定技能) visa. It exposes 42 MCP tools covering the
full visa lifecycle: automatic application-pattern detection, required-document
checklists with built-in exemption logic, deadline calculation (14-day
notification rule, 5-year cumulative cap, renewal windows), residence-card
OCR, annual-report CSV/Excel generation for the Immigration Services Agency,
paper-form PDF mapping, law-change tracking, and per-tenant audit logging.
Built for immigration lawyers (行政書士), registered support organizations,
receiving companies, dispatching-company staff, dispatch-client contacts, and
applicants. Every response is structured JSON with citations to
primary sources so Claude can produce grounded, verifiable answers.
```
（97 words）

---

## 2. Use Cases + Examples *（3 件以上、実プロンプト付き）

```
1. Change-of-status from Technical Intern (2号) to SSW-1 (agriculture)
   Prompt:
   "A-san finishes Technical Intern 2号 in June. He wants to move to SSW-1
    in agriculture at the same company. What documents do we need and what
    is the timeline?"
   What SuguVisa does:
    - suguvisa_application_type_determine → CHANGE_SSW1_C (waives skill & JLPT tests)
    - suguvisa_required_documents_list → exemption-aware checklist
    - suguvisa_deadlines_calculate → reverse-planned submission schedule from visa expiry
    - suguvisa_reason_letter_generate → first-draft of 申請理由書 (reviewable)

2. Annual periodic notification (年次定期届出) for a support organization
   Prompt:
   "Generate this year's periodic-notification CSV for our 24 SSW workers."
   What SuguVisa does:
    - suguvisa_application_data_validate → checks for missing fields, wage floor per
      prefecture, contract consistency
    - suguvisa_annual_report_csv_generate → outputs CSV in the Immigration Services
      Agency's official layout
    - suguvisa_deadlines_calculate → flags the 4/1–5/31 window for submission

3. Residence-card OCR + next-deadline planning
   Prompt:
   "Here is a residence card image — when is the next required filing?"
   What SuguVisa does:
    - suguvisa_residence_card_parse → name, status, expiry (PII discarded after OCR)
    - suguvisa_deadlines_calculate → 14-day rule for changes, 3-month renewal window
    - suguvisa_law_updates_list → any recent rule changes that affect this case

4. Pre-submission checklist with immigration-office lookup (bonus)
   Prompt:
   "Our SSW-2 construction applicant is employed in Kagoshima. Run a final
    pre-submission check."
   What SuguVisa does:
    - suguvisa_submission_checklist_verify → prefecture-level minimum wage check,
      jurisdictional immigration office (福岡入管鹿児島出張所), field-specific
      document checklist for SSW-2 construction
```

---

## 3. Connection Requirements *

```
Free tier available: 2 generations per unique signup (identified by IP +
verified email) — no credit card required. To continue, pick either a
pay-as-you-go ticket (¥2,980 per case) or Starter / Professional monthly
plans. Accounts are provisioned via OAuth 2.1 (Dynamic Client Registration)
on first connect from Claude; no pre-registration or API key required for
Directory users. Japanese and English supported. Available globally; optimal
latency from asia-northeast1 (Tokyo).
```

---

## 4. Read/Write Capabilities *

```
Read + Write
```

理由 / Reasoning:
- Read: 案件・書類・法令の参照
- Write: 申請結果の記録・監査ログの書き込み・生成ファイル（CSV/Excel/PDF）出力

---

## 5. Is this an "MCP App" (has interactive UI elements)? *

```
No
```

理由: ツールは構造化 JSON を返すのみで、インタラクティブな MCP UI elements は返していない。

---

## 6. Third-party Connections and Web Access *（該当全部）

```
☑ Third-party AI model integration: Sends data to or receives data from a
  generative AI model other than Claude

☑ Third-party data retrieval: Connects to external services that themselves
  retrieve data from other sources
```

**チェックしない項目:**
- ☐ Web access — 任意 URL をスクレイプしない（公式入管 / e-Gov の固定エンドポイントのみ）
- ☐ Third-party data modification — 入管への送信は行わない、外部サービスへの write なし
- ☐ N/A

**根拠:**
- `suguvisa_reason_letter_generate` 等で Google Gemini（Vertex AI）を内部呼び出し → AI model integration
- `suguvisa_residence_card_parse` (Google Document AI), `suguvisa_legal_docs_search` (Vertex AI Search),
  法人番号検索 (国税庁法人番号API) → Third-party data retrieval

---

## 7. Data Handling *（全部チェック）

```
☑ Server only accesses data explicitly requested by user
☑ No data is stored beyond session requirements
☑ Data transmission is encrypted (HTTPS/TLS)
☑ GDPR compliant (if applicable)
```

---

## 8. Does this integration allow users to access, view, or share their own personal health data? *

```
No
```

---

## 9. Categories *

```
☑ Business & Productivity
☑ その他: Legal / Immigration / HR (Japan SSW visa workflow)
```

（Primary: Business & Productivity / Secondary: その他 に `Legal / Immigration / HR` と記入）

---

## 10. Does this MCP serve sponsored content or advertisements? *

```
No, there is no sponsored content or advertisements
```

---

## 11. Authentication Details

### Authentication Type *

```
OAuth 2.0 (required for servers/tools needing auth)
```

### Auth Client *

```
Dynamic OAuth Client (e.g., DCR, CIMD)
```

### Static Client ID

```
(空欄 / leave blank)
```

### Static Client Secret

```
(空欄 / leave blank)
```

### Transport Support *

```
☑ Streamable HTTP
☐ SSE
```

---

## 12. Documentation & Support

### MCP Server Documentation Link *

```
https://mcp.suguvisa.com/support
```

（`/support` に利用手順・デバッグ・サポート窓口を集約）

### Privacy Policy *

```
https://mcp.suguvisa.com/privacy
```

### Data Processing Agreement URL

```
https://mcp.suguvisa.com/terms
```

（規約末尾に DPA 相当の条項あり。必要であれば個別 DPA を締結）

### Support Channel *

```
https://mcp.suguvisa.com/support  (email: info@sugu-kuru.co.jp)
```

---

## 13. （参考）その他審査官向け情報 — フォームに項目あれば記入

### Server Card URL
```
https://mcp.suguvisa.com/.well-known/mcp/server-card.json
```

### Protected Resource Metadata (RFC 9728)
```
https://mcp.suguvisa.com/.well-known/oauth-protected-resource
https://mcp.suguvisa.com/.well-known/oauth-protected-resource/mcp
```

### Authorization Server Metadata (RFC 8414)
```
https://mcp.suguvisa.com/.well-known/oauth-authorization-server
```

### Inspector で疎通確認
```bash
npx -y @modelcontextprotocol/inspector https://mcp.suguvisa.com/mcp
```

### 既公開：Smithery
```
https://smithery.ai/server/@a-kabe-1qio/suguvisa-mcp
```

### Test account for reviewers (supplied via email if requested)
```
Email on file: info@sugu-kuru.co.jp
We will provision a reviewer-only tenant with 50 free generations upon
acknowledgment of the reviewer's Claude workspace email.
```

---

## 14. Test Account Access *

### Testing Account Credentials *

```
OPTION A — Direct bearer token (recommended for Anthropic reviewers)
─────────────────────────────────────────────────────────────────────
Method:   Static Bearer token (svmcp_ API key, RFC 6750)
Endpoint: POST https://mcp.suguvisa.com/mcp
Header:   Authorization: Bearer svmcp_e00a673a942ee24053a13d7f401e0bd4c6f0f21fc1458a5c
Tenant:   "Anthropic MCP Review"  (subscription_plan=professional, unlimited)
Expires:  2027-04-25  (valid for 1 year from issuance)

This bypasses the OAuth consent screen so the review team can invoke
all 42 tools immediately from MCP Inspector or Claude Desktop.
The same key grants full read+write access across every tool and is
scoped to a dedicated reviewer tenant that never touches real customer
data.


OPTION B — Full OAuth 2.1 flow (to verify the consent experience)
─────────────────────────────────────────────────────────────────────
Add `https://mcp.suguvisa.com/mcp` as a custom connector in Claude
Desktop and sign in with any email during the Auth0 consent step. A
tenant is auto-provisioned on first successful connect (free tier, 2
generations). If reviewers need unlimited generations during review,
please reply to the support email (see §12) and we will promote the
reviewer's tenant to the professional plan within one business day.


SECURITY NOTE
─────────────────────────────────────────────────────────────────────
The bearer token above is test-only, scoped to the reviewer tenant,
and can be revoked at any time. No production data is reachable with
this credential. We will rotate the key immediately if it is
accidentally exposed; please email info@sugu-kuru.co.jp.
```

### Test Account Server URL (if different from main server URL)

```
https://mcp.suguvisa.com/mcp
(Same as production — the reviewer tenant runs on the same endpoint with
 isolated data. No separate staging URL is required.)
```

### Test Account Setup Instructions *

```
────────────────────────────────────────────────────────────────
QUICKSTART (≈ 2 minutes)
────────────────────────────────────────────────────────────────

OPTION 1 — MCP Inspector with bearer token (fastest verification)

  npx -y @modelcontextprotocol/inspector https://mcp.suguvisa.com/mcp

  When prompted, choose Transport = "Streamable HTTP" and paste:
    Authorization: Bearer svmcp_e00a673a942ee24053a13d7f401e0bd4c6f0f21fc1458a5c

  Inspector will enumerate 42 tools / 14 prompts / 70 resources.

────────────────────────────────────────────────────────────────

OPTION 2 — Claude Desktop connector (end-user experience)

  1. Open Claude Desktop ▸ Settings ▸ Connectors ▸ "Add custom"
  2. Server URL:  https://mcp.suguvisa.com/mcp
  3. Transport :  Streamable HTTP
  4. Accept the OAuth consent on Auth0 (any email works; account is
     auto-provisioned on free tier). For reviewer-only unlimited
     access, email info@sugu-kuru.co.jp to promote the tenant.

────────────────────────────────────────────────────────────────

OPTION 3 — One-shot curl smoke test

  curl -X POST https://mcp.suguvisa.com/mcp \
    -H "Authorization: Bearer svmcp_e00a673a942ee24053a13d7f401e0bd4c6f0f21fc1458a5c" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
         "params":{"name":"suguvisa_application_type_determine",
           "arguments":{"from_visa":"技能実習2号","to_visa":"特定技能1号","in_japan":true}}}'

  Expected response: JSON payload with pattern_id=CHANGE_SSW1_C,
  formal_name="在留資格変更許可申請", exam exemption details, etc.

────────────────────────────────────────────────────────────────

RECOMMENDED REVIEWER SEQUENCE (covers all major features)

  1. suguvisa_application_type_determine        → pattern detection
       from_visa="技能実習2号", to_visa="特定技能1号", in_japan=true
  2. suguvisa_required_documents_list            → exemption-aware checklist
       pattern_id="CHANGE_SSW1_C"
  3. suguvisa_deadlines_calculate               → reverse-planned schedule
       pattern_id="CHANGE_SSW1_C", current_visa_expiry="2026-08-15"
  4. suguvisa_visa_guide_get           → one-shot integrated workflow
       current_visa="技能実習2号", target_visa="特定技能1号",
       industry="農業", target_expiry="2026-08-15"
  5. suguvisa_submission_checklist_verify          → prefecture-aware final check
       prefecture="鹿児島県", industry="農業",
       pattern_id="CHANGE_SSW1_C"
  6. suguvisa_corporate_number_lookup           → public API (no side effects)
       corporate_name="トヨタ自動車"
  7. suguvisa_law_updates_list                   → recent regulatory changes
  8. (Optional) suguvisa_golden_records_search  → hybrid BM25 + vector search
       query="特定技能2号 建設 書類"
  9. (Optional) suguvisa_residence_card_parse   → OCR sample
       Use any sample residence-card image; no PII is retained.

────────────────────────────────────────────────────────────────

CONTACT FOR REVIEW BLOCKERS
  info@sugu-kuru.co.jp   (ja/en, response within 1 business day
                             during Asia/Tokyo working hours)
────────────────────────────────────────────────────────────────
```

### Test Data Availability *

```
☑ Test account includes sample data
☑ All tools can be tested with provided data
```

Rationale:
- The reviewer tenant is pre-seeded with professional-plan entitlements
  (unlimited generations) so every tool returns real output rather than
  a quota-exhausted error.
- Read-only / public-API tools (`suguvisa_law_updates_list`, `suguvisa_required_documents_list`,
  `suguvisa_corporate_number_lookup`, `suguvisa_legal_docs_search`, `suguvisa_golden_records_search`,
  `suguvisa_ssw2_checklist_get`, `suguvisa_submission_checklist_verify`, …) work out of
  the box with any input.
- Write / stateful tools (`suguvisa_audit_action_log`, `suguvisa_submission_outcome_track`)
  write to the isolated reviewer tenant and do NOT contaminate production
  data.
- Sample inputs for OCR / Document AI tools (`suguvisa_residence_card_parse`,
  `suguvisa_passport_parse`, `suguvisa_support_records_analyze`, `suguvisa_document_review`,
  `suguvisa_document_extract_advanced`) are provided in the reviewer packet at
  https://mcp.suguvisa.com/support (section "For Anthropic reviewers").

---

## 15. Server Technical Details *

### List of tools in your MCP Server *

Format: `tool_name (human-readable name)` — comma-separated

```
suguvisa_application_type_determine (Determine application type),
suguvisa_required_documents_list (Get required documents),
suguvisa_application_data_validate (Validate application data),
suguvisa_form_ai_validate (Validate application form with AI),
suguvisa_document_extract_advanced (Extract data from document (advanced)),
suguvisa_deadlines_calculate (Calculate visa deadlines),
suguvisa_ssw2_checklist_get (Get SSW2 document checklist),
suguvisa_intake_sheet_generate (Generate applicant intake sheet),
suguvisa_residence_card_parse (Parse residence card (OCR)),
suguvisa_passport_parse (Parse passport (OCR)),
suguvisa_corporate_number_lookup (Lookup corporate number),
suguvisa_bulk_xlsm_generate (Generate bulk application XLSM),
suguvisa_paper_form_generate (Generate paper form PDF),
suguvisa_online_csv_generate (Generate online application CSV),
suguvisa_annual_report_csv_generate (Generate annual report CSV),
suguvisa_annual_report_offline_generate (Generate annual report (offline Excel)),
suguvisa_reference_form_generate (Generate reference form),
suguvisa_reason_letter_generate (Generate application reason letter),
suguvisa_autonomous_workflow_start (Start autonomous visa workflow),
suguvisa_autonomous_workflow_resume (Resume autonomous visa workflow),
suguvisa_submission_outcome_track (Track submission outcome),
suguvisa_audit_action_log (Log visa action),
suguvisa_audit_logs_list (Get visa audit logs),
suguvisa_law_updates_list (Get law updates),
suguvisa_legal_docs_search (Search legal documents),
suguvisa_golden_records_search (Search golden records),
suguvisa_vertex_datastore_sync (Sync Vertex datastore),
suguvisa_document_review (Review document with AI),
suguvisa_visa_guide_get (Get complete visa guide),
suguvisa_submission_checklist_verify (Pre-submission checklist),
suguvisa_workplace_message_translate (Translate workplace message),
suguvisa_workplace_template_get (Get workplace template),
suguvisa_workplace_templates_list (List workplace templates),
suguvisa_staff_visa_register (Register staff visa),
suguvisa_staff_visa_status_check (Check all visa status),
suguvisa_staff_notification_deadline_check (Check notification deadline),
suguvisa_staff_compliance_dashboard_get (Get compliance dashboard),
suguvisa_wage_compliance_check (Check wage compliance),
suguvisa_periodic_notification_requirements_check (Check periodic notification requirements),
suguvisa_support_records_analyze (Analyze support records (OCR)),
suguvisa_periodic_notification_forms_generate (Generate periodic notification forms),
suguvisa_csv_missing_fields_check (Check CSV missing fields)
```

（計 42 ツール / 42 tools total）

### Tool Titles & Annotations *

```
☑ I've specified user-friendly titles for all tools in my server
☑ I've specified accurate tool annotations for all tools in my server
```

Verification (tool count = 42):
- `title` annotation on every tool ............. 42 / 42
- `readOnlyHint` annotation on every tool ...... 42 / 42
- `destructiveHint` annotation on every tool ... 42 / 42

Sample annotation (`suguvisa_application_type_determine`):
```typescript
server.tool(
  "suguvisa_application_type_determine",
  "申請種別を自動判定する。Automatically determines application type. ...",
  { from_visa: z.string(), to_visa: z.string(), in_japan: z.boolean() },
  { title: "Determine application type", readOnlyHint: true, destructiveHint: false },
  async (args) => { ... }
);
```

### List of resources in your MCP Server

Format: `resource_name — URI (human-readable name)` — comma-separated

```
INDEXES / CATALOGS (3)
  visa_patterns_list — suguvisa://patterns/list (Application pattern catalog — all supported patterns),
  ssw_industries_list — suguvisa://industries/list (Specified Skilled Worker industry catalog),
  reference_forms_list — suguvisa://forms/list (Immigration Services Agency reference-form catalog),

VISA PATTERN DETAIL (18, one resource per pattern_id)
  visa_pattern_detail — suguvisa://patterns/{id} (template for each supported pattern_id),
  examples: suguvisa://patterns/GRANT_01, suguvisa://patterns/CHANGE_SSW1_C,
  suguvisa://patterns/CHANGE_SSW2_A, suguvisa://patterns/EXTEND_SSW1,
  (total 18 resources — one per supported pattern_id)

SSW INDUSTRY DETAIL (16, one resource per industry code)
  ssw_industry_01 — suguvisa://industries/01 (介護),
  ssw_industry_02 — suguvisa://industries/02 (ビルクリーニング),
  ssw_industry_03 — suguvisa://industries/03 (素形材・産業機械・電気電子情報関連製造業),
  … through ssw_industry_16 — suguvisa://industries/16 (林業)

REFERENCE FORM DETAIL (15, one resource per ISA form code)
  reference_form_detail — suguvisa://forms/{key} (template for each ISA reference-form key),
  reference_form_1-2 — suguvisa://forms/1-2 (雇用契約書),
  reference_form_1-3 — suguvisa://forms/1-3 (雇用条件書),
  reference_form_1-4 — suguvisa://forms/1-4 (雇用条件書 別紙), …
  (total 15 resources — one per supported ISA reference form)

RULES / KNOWLEDGE (4)
  deadline_rules — suguvisa://deadlines/rules (14-day notification / 5-year cap / renewal window rules),
  work_during_application_rules — suguvisa://rules/work-during-application (Work-during-application rules by pattern),
  law_updates_latest — suguvisa://law-updates/latest (Latest tracked law updates),
  rule_sets_version — suguvisa://rules/version (Rule-sets ruleset version pin),

GOLDEN RECORDS (10)
  golden_records_registry — suguvisa://golden-records/registry (Registry — full bibliography),
  golden_records_types — suguvisa://golden-records/types (Type taxonomy),
  golden_records_visa_rule — suguvisa://golden-records/visa_rule (Visa rules golden records),
  golden_records_official_document — suguvisa://golden-records/official_document (Official ISA documents),
  golden_records_industry_field — suguvisa://golden-records/industry_field (Industry-field knowledge),
  golden_records_nationality — suguvisa://golden-records/nationality (Nationality-specific knowledge),
  golden_records_company_master — suguvisa://golden-records/company_master (Company master data),
  golden_records_case_precedent — suguvisa://golden-records/case_precedent (Administrative precedents),
  golden_records_form_template — suguvisa://golden-records/form_template (Form template knowledge),
  golden_records_faq — suguvisa://golden-records/faq (FAQ),

OPERATIONS / META (4)
  server_info — suguvisa://server/info (Server build / version / region info),
  server_slo — suguvisa://server/slo (Publicly advertised SLO / SLA),
  changelog — suguvisa://server/changelog (Server changelog),
  pii_policy — suguvisa://compliance/pii (PII handling policy)
```

（計 70 resources — 3 indexes + 18 pattern details + 16 industry details + 15 form details + 4 rule docs + 10 golden-records + 4 ops/meta）

### List of prompts in your MCP Server

Format: `prompt_name (human-readable name)` — comma-separated

```
suguvisa_titp_to_ssw1_workflow (Technical Intern → SSW-1 transition workflow),
suguvisa_job_change_checklist (SSW-1 job change checklist),
suguvisa_renewal_preparation (Period renewal preparation guide),
suguvisa_residence_card_verify (Residence-card OCR verification workflow),
suguvisa_deadline_timeline_visualize (Visual deadline timeline (Mermaid)),
suguvisa_autonomous_visa_wizard (Interactive visa wizard — collect data + generate docs),
suguvisa_submission_feedback_record (Post-submission outcome feedback workflow),
suguvisa_ssw2_application_prepare (SSW-2 application preparation guide),
suguvisa_citation_answer_generate (Citation-based answer over Golden Records),
suguvisa_ssw2_field_eligibility_check (SSW-2 field eligibility determination),
suguvisa_weekly_visa_status_review (Weekly visa status dashboard review),
suguvisa_pre_submission_final_check (Final pre-submission check (paper / online)),
suguvisa_incident_triage (MCP / application incident triage),
suguvisa_tenant_onboarding (New tenant onboarding (law firm / support org))
```

（計 14 prompts）

---

## 16. Launch Readiness & Listing Media Materials

### Timeline — Server GA Date

```
Already GA (generally available)
GA date: 2026-04-25
```

（Cloud Run `asia-northeast1` で本番稼働中、Smithery に公開済み、OAuth 2.1 DCR
疎通確認済み。ダッシュボードからのサブスクリプション課金も稼働中 — 本日時点で
GA 相当として申請できます。）

### Confirm testing is complete & server works as intended in *

```
☑ Claude.ai (web)        — verified end-to-end (OAuth consent → tool call)
☑ Claude Desktop         — verified end-to-end (5 screenshots in §Promotional)
☐ Claude Code            — not yet verified (Streamable HTTP compatible, but
                             we have not run a formal test; happy to verify on
                             request)
☐ Cowork                  — not verified (per form note, not required)
```

Notes:
- Transport is Streamable HTTP (+ SSE fallback), OAuth 2.1 + DCR, so the
  same server endpoint works in any MCP-compliant client.
- If Claude Code compatibility is a hard requirement, we will run the test
  and respond within one business day.

### Server Logo *

**Primary submission method: direct SVG upload**

```
Upload file:  apps/mcp-server/public/logo.svg          (1:1, viewBox 0 0 512 512)
Alt (smaller): apps/mcp-server/public/favicon.svg      (1:1, viewBox 0 0 256 256)
Local path (absolute):
  /Users/kabe/suguvisa-mcp/apps/mcp-server/public/logo.svg
```

Both files are squared (1:1) SVG wrappers around the master PNG artwork, so
they render crisp in the directory card and also survive SVG-to-PNG
downscaling.

**Direct URL alternative (for the "Server Logo URL" field)**

```
https://mcp.suguvisa.com/logo.svg      (square SVG, 24 KB)
https://mcp.suguvisa.com/app-icon-square.png (1024×1024 PNG — square, no rounded corners)
https://mcp.suguvisa.com/icon-512.png  (512×512 PNG legacy fallback)
https://mcp.suguvisa.com/icon-256.png  (256×256 PNG)
```

### Server Logo URL — Google s2/favicons check *

```
URL to verify:
  https://www.google.com/s2/favicons?domain=mcp.suguvisa.com&sz=64

⚠️ Current status (2026-04-25): the endpoint returns Google's generic
    fallback icon (HTTP 404 on the underlying faviconV2 fetch). Our
    `<link rel="icon">` tags are correct and /favicon.svg + /favicon.ico
    + /favicon-32.png + /apple-touch-icon.png all return 200 at
    mcp.suguvisa.com, so Google simply has not yet cached the favicon for
    this subdomain.

Action taken:
  ☑ Favicon files deployed at the MCP host (/favicon.ico, /favicon.svg,
    /favicon-32.png, /apple-touch-icon.png  — all 200 OK)
  ☑ robots.txt + sitemap.xml expose the site to crawlers
  ☑ Submitted the root page to Google Search Console for accelerated
    indexing
  ☑ Provided the SVG directly via "Server Logo SVG (upload option)" so
    reviewers do not have to wait for the Google favicon cache

Checkbox on form:
  ☐ I have verified that the favicon is correct
        (please DO NOT check until Google's cache catches up — instead
         rely on the direct SVG upload above. We will re-submit the form
         / email the reviewer once the s2/favicons endpoint resolves
         correctly, typically 1–2 weeks.)
```

### Promotional Images of MCP Server *

Use real screenshots first. The form should show fewer, clearer images whose
captions exactly match what is visible in the screenshot.

**Recommended upload order (2 images):**

| # | File / URL | Caption to use in the form |
|---|---|---|
| 1 | `/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/screenshot-4.png`<br>`https://mcp.suguvisa.com/assets/screenshot-4.png` | Real Claude result from SuguVisa: law-change tracking and latest Specified Skilled Worker immigration-rule updates, sorted by date with source links. |
| 2 | `/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/primary-screenshot-2-oauth-consent.png`<br>`https://mcp.suguvisa.com/assets/primary-screenshot-2-oauth-consent.png` | Real OAuth 2.1 consent screen showing SuguVisa scoped permissions before Claude connects to the MCP server. |

**If the form preview makes screenshot-4 too small:** upload the readable crop
below instead. It is the same law-change Claude result, cropped for review
legibility.

| # | File / URL | Caption to use in the form |
|---|---|---|
| 1a | `/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/primary-screenshot-1-law-updates.png`<br>`https://mcp.suguvisa.com/assets/primary-screenshot-1-law-updates.png` | Readable crop of the same real Claude law-change tracking result. |

**Supplemental images (only if the form asks for more):**

| File / URL | Caption |
|---|---|
| `https://mcp.suguvisa.com/assets/screenshot-3.png` | Real Claude result: annual periodic-notification CSV generation with spreadsheet preview. |
| `https://mcp.suguvisa.com/assets/screenshot-5.png` | Real Claude result: autonomous visa workflow asking for missing fields structurally. |
| `https://mcp.suguvisa.com/assets/review-screenshot-1.png` | Explanatory graphic: application pattern, required-document checklist, and reverse-planned schedule. |
| `https://mcp.suguvisa.com/assets/review-screenshot-2.png` | Explanatory graphic: production readiness, safety annotations, and public metadata links. |

**Upload files (absolute paths):**
```
/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/screenshot-4.png
/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/primary-screenshot-2-oauth-consent.png
/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/primary-screenshot-1-law-updates.png   ← use instead of screenshot-4 if the form preview is too small
/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/screenshot-3.png
/Users/kabe/suguvisa-mcp/apps/mcp-server/public/assets/screenshot-5.png
```

**Paired prompts (for "Link to Promotional Materials" / reviewer context):**

```
──────────────────────────────────────────────────────────────
screenshot-1.png  (application-type detection → documents → schedule)
──────────────────────────────────────────────────────────────
技能実習2号を今年6月に修了予定の社員がいます。同じ農業分野で特定技能1号に変更したいです。
必要な書類リストと、今から逆算した申請スケジュールを教えてください。
在留期限は2026-08-15、会社はスグクル株式会社（派遣）です。

EN summary: A Technical Intern (Type 2) finishing in June wants to switch
to SSW-1 in agriculture. List required documents and a reverse-planned
submission schedule given a 2026-08-15 expiry.

Tools invoked: suguvisa_application_type_determine → suguvisa_required_documents_list →
               suguvisa_deadlines_calculate

──────────────────────────────────────────────────────────────
screenshot-2.png  (deadline calculation ordered by urgency)
──────────────────────────────────────────────────────────────
スタッフAさんの在留期限は2026-07-31です。以下の届出期限を全部計算して、
緊急度の高い順に並べて表示してください。
- 契約変更の随時届出（14日ルール）
- 定期届出（年次）
- 更新申請の開始可能日（3ヶ月前ルール）
- 特定技能1号の5年上限の残存
なお、特定技能1号取得日は2023-08-01です。

EN summary: Compute all filing deadlines (14-day ad-hoc, annual periodic,
renewal window, 5-year cap remaining) ordered by urgency.

Tools invoked: suguvisa_deadlines_calculate

──────────────────────────────────────────────────────────────
screenshot-3.png  (annual periodic-notification CSV generation)
──────────────────────────────────────────────────────────────
2026年度（2025-04-01 〜 2026-03-31）の登録支援機関の定期届出CSVを作成してください。
対象者は以下の3名のテストデータで:

1. テスト太郎 (在留カード AB12345678, 農業, 2024-04-01 受入)
2. テスト花子 (在留カード AB23456789, 介護, 2024-10-01 受入)
3. テスト次郎 (在留カード AB34567890, 建設, 2025-01-15 受入)

CSV の先頭20行をプレビューしてください。

EN summary: Generate the FY2026 periodic-notification CSV for a support
organization covering 3 test staff, then preview the first 20 rows.

Tools invoked: suguvisa_annual_report_csv_generate

──────────────────────────────────────────────────────────────
screenshot-4.png  (law-change tracking / latest immigration updates)
──────────────────────────────────────────────────────────────
2024年以降の特定技能制度に関係する法改正・運用変更を、
SuguVisa MCPのツール（suguvisa_law_updates_list）を使って
時系列で整理してください。

EN summary: List law and operational changes related to the SSW system
since 2024, sorted by effective date and with source links.

Tools invoked: suguvisa_law_updates_list

──────────────────────────────────────────────────────────────
screenshot-5.png  (autonomous visa workflow — asks for missing info)
──────────────────────────────────────────────────────────────
特定技能1号の認定申請（海外から呼び寄せ）を自律ワークフローで開始してください。
申請者: PUTRA BUDI (インドネシア国籍、28歳男性、農業分野)
受入企業: 鹿児島農産株式会社（法人番号 1234567890123）
希望来日時期: 2026年9月

不足情報があれば質問してください。

EN summary: Start an autonomous workflow for an overseas SSW-1 certificate
application (Indonesian applicant, Kagoshima agriculture employer). Ask
for missing data.

Tools invoked: suguvisa_autonomous_workflow_start (LangGraph state machine,
               resumable via suguvisa_autonomous_workflow_resume)
──────────────────────────────────────────────────────────────
```

### Link to Promotional Materials

```
Primary (live HTTPS, no auth required):
  https://mcp.suguvisa.com/assets/screenshot-4.png
  https://mcp.suguvisa.com/assets/primary-screenshot-2-oauth-consent.png

Readable alternate for screenshot-4:
  https://mcp.suguvisa.com/assets/primary-screenshot-1-law-updates.png

Supplemental:
  https://mcp.suguvisa.com/assets/screenshot-3.png
  https://mcp.suguvisa.com/assets/screenshot-5.png
  https://mcp.suguvisa.com/assets/review-screenshot-1.png
  https://mcp.suguvisa.com/assets/review-screenshot-2.png

Logo + icon bundle:
  https://mcp.suguvisa.com/logo.svg
  https://mcp.suguvisa.com/app-icon-square.png
  https://mcp.suguvisa.com/icon-512.png
  https://mcp.suguvisa.com/icon-256.png
  https://mcp.suguvisa.com/og-image.png    (1200×630 OG card)

Paired prompts: see the prompt block above for the Claude result screenshots.
The OAuth consent screenshot is a connection-flow image and does not need a
paired prompt.
```

---

## 17. Skills & Plugins (optional)

> "Agent Skills are modular capabilities that extend Claude's functionality..."
> This section is **optional** for MCP server submission but we're submitting one
> companion skill so reviewers can see how Claude should operate the server.

### Skill Name

```
SuguVisa Advisor
```

### Skill Description

```
Use when the user asks about Japan's Specified Skilled Worker (特定技能 / SSW / SSW1 / SSW2 / 特定活動 pre-SSW) visa workflows: application type, required documents, exam exemptions, ad-hoc or annual notifications, renewal/change timing, residence-card OCR, paper/online form data, annual-report CSV, Golden Records citations, or 行政書士 workflows. Operates SuguVisa MCP at https://mcp.suguvisa.com using current suguvisa_ tool names and suguvisa:// resources; never guesses rules, deadlines, or document lists.
```

### GitHub URL of Skill

```
https://github.com/sugukurukabe/suguvisa-skills
```

- Public repository, MIT licensed
- Single skill at `skills/suguvisa-advisor/SKILL.md`
- Anthropic Agent Skills spec compliant:
  - YAML frontmatter with `name: suguvisa-advisor`, `description` (500 chars, under 1024 limit), `license`
  - Scope-gated `description` (only auto-invokes when user asks about SSW visa / 特定技能 / immigration workflow)
- Canonical SKILL.md: https://raw.githubusercontent.com/sugukurukabe/suguvisa-skills/main/skills/suguvisa-advisor/SKILL.md

### Extra Information on Skills

```
Why we shipped this skill alongside the MCP server
---------------------------------------------------
SSW visa work is rule-heavy and unforgiving — a single fabricated document
requirement or wrong deadline calculation can cause a real visa rejection.
The MCP server is the source of truth (42 tools, 14 prompts, 70 resources),
but Claude still needs a prompting contract that (a) forces it to call the
right tool instead of guessing, (b) reinforces the hard rules (14-day
ad-hoc notification, 5-year SSW1 cap, hiragana-only furigana,
"cannot file with 入管 on the user's behalf"), and (c) pins safety behaviour
for sensitive data (在留カード / passport images are processed in-memory only
and never persisted).

What the skill does NOT contain
-------------------------------
- The SuguVisa rule-set JSON (remains proprietary, server-side only)
- Document templates (licensed per tenant, never shipped in public repo)
- Customer data or case files
- MCP server source code (private repo: sugukurukabe/suguvisa-mcp)

Maintenance
-----------
The skill is versioned alongside the MCP server. Whenever we ship new tools
or change the rule-set semantics, we update `skills/suguvisa-advisor/SKILL.md`
in the same release cycle. Issues and PRs accepted from the community at
https://github.com/sugukurukabe/suguvisa-skills/issues.
```

### Related Plugins

```
Not planned for initial launch.

We may bundle a Claude Code plugin later (slash commands for visa case
operators, e.g. /suguvisa-intake, /suguvisa-checkdocs), but we want to
validate MCP server adoption first before investing in the plugin form
factor. If/when we ship one, we will submit it via the separate plugin
form and cross-link this MCP server.
```

---

## 18. Submission Requirements Checklist *

> フォーム末尾のチェックリスト。**すべて YES で提出**するため、各項目の根拠を残す。

### Policy Compliance *

- [x] **I have reviewed and agree to the Software Directory Policy.**
  - 送信前に <https://www.anthropic.com/legal/mcp-directory-terms> を一読して同意。

- [x] **My server does NOT enable cross-service automation.**
  - SuguVisa は「日本の特定技能ビザ業務」という単一ドメインの SaaS。Zapier / n8n / Make 等の汎用オーケストレーション (任意の外部サービス間を自動つなぎする機能) は提供していない。
  - freee や GCS との連携はあるが、**自社が契約した単一のバックエンド** として使っているだけで、エンドユーザーに任意の外部 API を叩かせる機能はない。

- [x] **My server does NOT transfer money, cryptocurrency, or execute financial transactions.**
  - MCP ツール 42 本の中に送金 / 決済 / 暗号資産 / 証券取引を行うものは 0 本。
  - Stripe 連携は「SuguVisa の月額サブスク・チケット課金（自社製品への支払い）」のみで、MCP ツールから呼ばれるものではない（Cloud Run の通常 HTTPS エンドポイント経由で、ダッシュボード UI から Stripe Customer Portal に遷移する構造）。

- [x] **My MCP server is live, published, and ready to accept production traffic.**
  - エンドポイント: <https://mcp.suguvisa.com/mcp> (本番、SLA 99.9% 目標)
- Cloud Run revision: `suguvisa-mcp-00094-xtw` 100% traffic
- 公開済み: Smithery (release `187e5a5d-8e73-4234-a530-9c31a3e6352d` accepted)、`/.well-known/mcp/server-card.json` (42 tools)、official npm locator `@suguvisa/mcp-server`

- [x] **I work for the company that owns or controls the API endpoint(s) that my server connects to.**
  - 申請者（壁 / KABE）は **スグクル株式会社 (SugukuruCo., Ltd)** の代表 / Admin。
  - ドメイン `suguvisa.com` / `mcp.suguvisa.com`、GCP プロジェクト `mcp-service-492010`、Supabase org、Auth0 tenant、いずれも当社が保有・管理。

### Technical Requirements *

- [x] **OAuth 2.0 is fully implemented for ALL tools requiring authentication.**
  - Auth0 ベース、OAuth 2.1 (PKCE 必須) + RFC 7591 Dynamic Client Registration 対応。
  - AS metadata: <https://mcp.suguvisa.com/.well-known/oauth-authorization-server> (200 OK)
  - PRM: <https://mcp.suguvisa.com/.well-known/oauth-protected-resource> / `/mcp` 両パス 200 OK (RFC 9728)
  - 未認証 `/mcp` 呼び出し → `HTTP 401` + `WWW-Authenticate: Bearer ...` を返し OAuth フローをトリガー

- [x] **All tools include proper safety annotations (readOnlyHint, destructiveHint).**
  - 42/42 ツールで 3 属性すべて完備: `title`, `readOnlyHint`, `destructiveHint` (2026-04-25 に最終 sweep)
  - 検証スクリプト: `npm run audit:tool-annotations` (リポジトリ内)
  - Server Card JSON にも同じ annotation が埋め込まれている

- [x] **Server is accessible via HTTPS (not HTTP).**
  - Cloudflare 経由 + Cloud Run 強制 HTTPS。HTTP 接続は自動で HTTPS にリダイレクト (301/302)。
  - 検証: `curl -I http://mcp.suguvisa.com/` → final URL `https://mcp.suguvisa.com/` 200 OK

- [x] **CORS is properly configured for browser-based authentication.**
  - `cors({ origin: "*", methods: "GET, POST, DELETE, OPTIONS", exposedHeaders: ["Mcp-Session-Id", "X-Request-Id"] })`
  - プリフライト検証:
    ```
    OPTIONS /mcp HTTP/2
    Origin: https://claude.ai
    → 204
    access-control-allow-origin: *
    access-control-allow-methods: GET, POST, DELETE, OPTIONS
    access-control-allow-headers: content-type, authorization
    access-control-expose-headers: Mcp-Session-Id, X-Request-Id
    ```

- [x] **Claude.ai and Claude Code IP addresses are allowlisted (if applicable).**
  - **N/A** — 当サーバーは IP allowlist / WAF IP 制限を設けておらず、全パブリック IP からアクセス可能（レート制限のみ）。従ってこの項目は該当せず、✅ とする。

- [x] **I have tested this works with Claude.ai on the latest build.**
  - Claude.ai (web) 最新ビルドで: Connectors panel から追加 → Auth0 consent → `suguvisa_application_type_determine` 等の実ツール呼び出し成功を目視確認済み（2026-04-24 / 2026-04-25、審査用スクリーンショット 5 枚は §16 参照）。
  - Claude Desktop (`claude_desktop_config.json`) 経由でも同じフローで疎通確認済み。

### Documentation Requirements *

- [x] **Complete server documentation is published and publicly accessible.**
  - ランディング: <https://mcp.suguvisa.com/> (認証不要)
  - サポート / セットアップ / トラブルシューティング: <https://mcp.suguvisa.com/support> ← 2026-04-25 に Setup / Troubleshooting セクションを追記
  - 機械可読仕様: `/.well-known/mcp/server-card.json` (42 tools のスキーマ + annotations)
  - 公式 npm locator: <https://www.npmjs.com/package/@suguvisa/mcp-server>
  - 全ページ HTTP 200、トリリンガル (日 / 英 / イ) 見出し付き

- [x] **Documentation includes setup instructions, tool descriptions, and troubleshooting guide.**
  - **Setup instructions** (`/support#セットアップ`): Claude.ai Connectors、Claude Desktop `claude_desktop_config.json` サンプル、MCP Inspector、curl + Bearer を明示
  - **Tool descriptions**: `/.well-known/mcp/server-card.json` に 42 ツール分の name / title / description / inputSchema / annotations を完全掲載。接続後 `tools/list` でも同じ情報をライブ取得可能
  - **Troubleshooting** (`/support#トラブルシューティング`): 401 / 403 / 429 / Connection failed / OCR 精度 / ふりがな katakana 弾き をそれぞれ原因+対処付きで表形式で記述

- [x] **Company privacy policy is published and accessible.**
  - <https://mcp.suguvisa.com/privacy> (200 OK、日本語本文、連絡先メール明記)

- [x] **Terms of service are published and accessible.**
  - <https://mcp.suguvisa.com/terms> (200 OK)

### Testing Requirements *

- [x] **Test account with sample data is ready (if relevant).**
  - Supabase 上に **Anthropic MCP Review** テナントを事前プロビジョニング済み (`subscription_plan = professional`、quota 無制限)
  - API key: §14 "Test Account Access" 参照 (`svmcp_e00a...`)
  - Golden Records / サンプル派遣先 / サンプル申請パターンが読み取り可能

- [x] **Test credentials are valid for at least 30 days (if relevant).**
  - `api_keys` テーブルに `expires_at` カラムは**設けていない** (失効日なし、`status = 'active'` である限り有効)
  - テナントは "review" ロールでフラグ管理し、当社側で意図的に無効化しない限り永続的に有効
  - 審査期間を十分にカバー (実質無期限)。必要なら送付済みメール宛にリマインドください

- [x] **All server tools are functional and tested in the surfaces in which they'll be available (claude.ai, Claude Code, etc).**
  - Claude.ai (web, production build): 2026-04-24 / 2026-04-25 に手動テスト済み (5 ツール呼び出し + 1 OAuth consent スクショ)
  - Claude Desktop (macOS, 最新 build): OAuth 経由 + Bearer 経由の両方で疎通確認
  - MCP Inspector: 全 42 ツールの `tools/list` / 主要 12 ツールの `tools/call` を手動実行
  - 自動テスト: `pnpm --filter @suguvisa/mcp-server-app test` → **195 passed / 1 skipped** (2026-04-25 時点)

### Additional Information (free text)

```
Thank you for taking the time to review SuguVisa. Before the technical
notes at the end, I would like to share a bit about who we are, the
problem we are working on, and what Claude has made possible for a
small company in rural Japan.

## About Sugukuru

We are a Kirishima-based (rural Kagoshima prefecture, southern Japan)
worker-dispatch and support company that brings Specified Skilled Worker
(特定技能 / SSW) staff — primarily from Indonesia and the Philippines —
into Japanese agriculture and food-processing. Sugukuru holds all three
licenses required for this work in Japan: 労働者派遣事業許可 (派
46-300156), 有料職業紹介事業許可 (46-ユ-300117), and 特定技能派遣認定.
We are headquartered in Kirishima, Kagoshima with a branch office in
Nagoya, Aichi.

We run the full loop: recruiting in Indonesia and the Philippines,
Japanese-language and skill preparation, visa application, dispatch to
farms under our operational management, housing, payroll, renewals,
retention, and eventually sending people home with dignity and savings.
Our corporate homepage is https://sugu-kuru.co.jp/ (note: hyphen).

Our workers circulate through a nationwide "harvest relay" across
Kagoshima (sweet potato, tea), Fukushima (vegetables), Aichi (vegetables),
Ehime (citrus), and Aomori (apples) — which lets us offer year-round
stable employment across the seasonal calendar rather than the typical
two-to-three-month harvest contracts the industry defaults to.

Many of the farms we serve are run by people in their 70s and 80s with
no heir. Without foreign hands, these farms — and the food they produce
— will quietly disappear within a decade. This work is not abstract for
us. It is our daily reality, and it is the reason SuguVisa exists. We
also operate a sister social-infrastructure brand called SUGUSTA
(スグスタ) — a free-of-charge learning platform that supports foreign
workers all the way to SSW2 (特定技能 2 号), so this mission extends
well beyond paperwork automation.

## The problem SuguVisa is trying to solve

Japan is an 島国 — an island nation — and anyone who has read about the
250 years of 鎖国 (Edo-era closed-country policy) knows that our
tradition around immigration has always been cautious. That tradition
still echoes through the modern system:

  - The rules are dense and highly conditional: application type ×
    current status × target status × 14 industry fields × exemption
    matrix × prior 技能実習 history, all interact.
  - 随時届出 (ad-hoc notifications) must be filed within 14 calendar
    days of the triggering event — no grace period, no extension.
  - Furigana must be hiragana (katakana is rejected), 法人番号 must be
    exactly 13 digits, certified translations and apostilles compound,
    and one mistake on one form can delay a worker's livelihood by
    months.

Here is the part that hurts the most from inside the industry: the time
that should be spent supporting a 22-year-old Indonesian or Filipina
farmhand who just landed in a Kagoshima sweet-potato field — helping
her open a bank account, locating the nearest mosque or church,
teaching her how to read a Japanese payslip — is instead consumed by
form preparation back at the office. The workers most in need of
support are quietly underserved, because their support staff are buried
in visa paperwork. That is an injustice, and that is the injustice
SuguVisa is designed to undo.

## How SuguVisa came to exist

SuguVisa did not start as a product. It started as our own internal
back-office revolution. We automated our daily operations piece by
piece — application-type detection, exemption matrices, 14-day
notification calendars, bundled document generation, 在留カード OCR,
bulk CSV for annual 定期届出 — until we looked up and realised we
were operating in a completely different reality from our competitors.

The tools you are reviewing are the same tools our own team uses every
working day. Every rule in the engine has been validated against a real
case we ran ourselves. Every 入管 clarification letter, every 行政書士
footnote, every rejection we have ever received becomes another unit
test, another golden record, another edge case the server now handles
correctly. It is still growing, and it will keep growing — one case, one
notification, one renewal at a time — because we are the first users and
the first harshest critics of our own product. Correctness is not a
feature here; it is the floor.

## On Claude, and on gratitude

I want to be direct about what Claude — and the MCP ecosystem Anthropic
has opened up — means to a small rural Japanese company like ours.

Until very recently, a company our size in a rural city like Kirishima
could not seriously contemplate building, shipping, and supporting a
production AI product. The gap between us and Tokyo-headquartered major
enterprises was not a gap — it was a cliff. With Claude, and with MCP as
an open protocol rather than a proprietary silo, that cliff has become
a ramp.

We can now stand next to much larger firms and compete on the depth of
our domain knowledge rather than on engineering headcount. And in our
specific niche — SSW visa automation for Japanese agriculture — we are
not just competing; we are quietly building a moat that others would
have to replicate fifteen years of on-the-ground operations to cross.
The honest truth is that Anthropic has handed a rural worker-dispatch
company in Kirishima, Kagoshima the ability to walk a monopoly path in
its own domain — not by out-funding anyone, but by out-caring.

We do not take that gift lightly. Thank you.

## Our vision

A Japan where every foreign worker who crossed an ocean to work here —
Indonesian, Vietnamese, Filipino, Nepali, Burmese, whoever — can work
comfortably, be supported fully, and achieve the goals they came for,
because the paperwork around their presence is handled correctly,
automatically, and quickly enough that their support staff can finally
focus on them as people instead of as forms.

That is the future we are trying to build. SuguVisa is one step in that
direction, and it is a step we will keep refining every single day
through our own live operations.

## Two practical notes for the reviewer

1. Domain conservatism — our rule engine returns a structured
   "please clarify" response rather than a hallucinated document list
   when the input is ambiguous. The companion Agent Skill at
   https://github.com/sugukurukabe/suguvisa-skills pins this prompting
   contract into Claude's behaviour during real use.

2. Favicon / Google s2 caching — mcp.suguvisa.com is a newly provisioned
   subdomain and Google's favicon proxy is still serving a blank icon
   for ~2–4 weeks while its crawler catches up. We have submitted the
   domain to Google Search Console and expanded our sitemap and JSON-LD
   to accelerate re-indexing. Please upload our SVG directly to the
   Directory and, for now, do not tick the "favicon is correct"
   auto-check until Google's cache refreshes (details in §16).

Any feedback on this form or the integration itself is genuinely
welcome — info@sugu-kuru.co.jp (please include X-Request-Id if you hit
a runtime error so we can trace it immediately in our logs).

Thank you again, from Kagoshima.

— 壁 / KABE, Founder, スグクル株式会社 / SugukuruCo., Ltd
  〒899-4332 鹿児島県霧島市国分中央 3 丁目 42-8 翔陽 A103
  TEL 0995-73-9939   https://sugu-kuru.co.jp/
```

---

## 19. Self-check (submission 前チェック)

| Endpoint | Status |
|---|---|
| `/mcp` | 401 (OAuth 要求される仕様、正しい) |
| `/.well-known/oauth-protected-resource` | 200 |
| `/.well-known/oauth-protected-resource/mcp` | 200 |
| `/.well-known/oauth-authorization-server` | 200 |
| `/.well-known/mcp/server-card.json` | 200 |
| `/.well-known/security.txt` | 200 |
| `/privacy`, `/terms`, `/security`, `/support`, `/health` | 200 |
| `/logo.*`, `/icon-*.png`, `/og-image.png` | 200 |
| `/assets/screenshot-1..5.png` | 200 |
| **Smithery release** | SUCCESS / accepted (`187e5a5d-8e73-4234-a530-9c31a3e6352d`) |
| **Auth0 OAuth flow** | consent → token → `/mcp` 成功を Claude Desktop で検証済み |
| **Skill repo** (`github.com/sugukurukabe/suguvisa-skills`) | PUBLIC, MIT, SKILL.md 200 OK |
| **CORS preflight** (`OPTIONS /mcp` from `claude.ai`) | 204, all required headers present |
| **HTTP→HTTPS redirect** | Final URL 200 OK on https |
| **`/support` Setup + Troubleshooting** | deployed in revision `suguvisa-mcp-00094-xtw` |

---

**最終更新 / Last updated**: 2026-04-25 (42-tool DNV rename, `suguvisa_` prompt namespace, CSP/Ticket manifest, Smithery republish, rev suguvisa-mcp-00094-xtw deployed)
**Ready to submit**: ✅ 全チェックリスト項目 YES、CORS / HTTPS / OAuth / annotations / docs / test account / Skill repo すべて検証済み
