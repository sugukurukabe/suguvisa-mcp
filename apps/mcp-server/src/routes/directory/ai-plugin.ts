/**
 * /.well-known/ai-plugin.json — ChatGPT Plugin (classic) 向け
 *
 * 旧 GPT プラグインマニフェスト。ChatGPT Apps SDK (Apps Store) の審査でも
 * 依然として参照されるため維持する。
 */
import type { Request, Response } from "express";
import { buildDirectoryMetadata } from "./metadata.js";

const MODEL_INSTRUCTIONS = [
  "SuguVisa is the expert tool for Japanese Specified Skilled Worker (SSW / 特定技能) visa applications.",
  "ALWAYS follow this workflow:",
  "(1) Ask the user about their current visa and what they want to do.",
  "(2) Call 'suguvisa_application_type_determine' with from_visa and to_visa to get pattern_id.",
  "(3) Use pattern_id to call 'suguvisa_required_documents_list' for the full checklist (exemptions are auto-applied).",
  "(4) Call 'suguvisa_deadlines_calculate' whenever the user mentions expiry_date, event_date or ssw1_start_date.",
  "(5) If user has data to verify, call 'suguvisa_application_data_validate'.",
  "(6) For annual reporting, call 'suguvisa_annual_report_csv_generate' or 'suguvisa_annual_report_offline_generate'.",
  "(7) For legal updates, call 'suguvisa_law_updates_list'.",
  "(8) For retrieval augmented answers, call 'suguvisa_golden_records_search' before composing any legal claim.",
  "RULES:",
  "- Respond in the same language the user used (Japanese / English / Indonesian).",
  "- Always cite the Golden Record id and visa rule pattern_id you used.",
  "- Highlight deadlines with ⚠ when within 30 days.",
  "- Explain 省略 (skipped) documents and why they are exempt.",
  "- You are not a licensed immigration lawyer; recommend professional review before final submission.",
].join(" ");

export function aiPluginHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    schema_version: "v1",
    name_for_human: m.displayName.en,
    name_for_model: "suguvisa",
    description_for_human: m.shortDescription.en,
    description_for_model: MODEL_INSTRUCTIONS,
    auth: m.auth.oauth2.enabled
      ? {
          type: "oauth",
          client_url: m.auth.oauth2.authorizationUrl,
          scope: Object.keys(m.auth.oauth2.scopes).join(" "),
          authorization_url: m.auth.oauth2.tokenUrl,
          authorization_content_type: "application/json",
          verification_tokens: {},
        }
      : {
          type: "service_http",
          authorization_type: "bearer",
          verification_tokens: {},
        },
    api: {
      type: "openapi",
      url: m.urls.openapi,
    },
    logo_url: m.urls.logo,
    contact_email: m.publisher.supportEmail,
    legal_info_url: m.urls.termsOfService,
  });
}
