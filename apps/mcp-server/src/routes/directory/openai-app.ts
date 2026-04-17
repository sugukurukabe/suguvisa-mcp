/**
 * /.well-known/openai-app.json — ChatGPT Apps SDK (Apps Store) 向け
 *
 * OpenAI Apps SDK は MCP サーバーを "App" として公開するための新マニフェスト。
 * Claude Connectors と違い app_id / developer / distribution / scopes 等を
 * 厳密に要求するため専用エンドポイントとして分離する。
 */
import type { Request, Response } from "express";
import { buildDirectoryMetadata } from "./metadata.js";

export function openaiAppHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    schema_version: "1.0",
    app_id: m.slug,
    name: m.displayName.en,
    localized_names: m.displayName,
    tagline: m.shortDescription.en,
    localized_taglines: m.shortDescription,
    description: m.longDescription.en,
    localized_descriptions: m.longDescription,
    categories: m.categories,
    tags: m.tags,
    icon_url: m.urls.logo,
    screenshots: [
      `${m.urls.baseUrl}/assets/screenshot-1.png`,
      `${m.urls.baseUrl}/assets/screenshot-2.png`,
      `${m.urls.baseUrl}/assets/screenshot-3.png`,
    ],
    developer: {
      name: m.publisher.displayName,
      legal_name: m.publisher.legalName,
      website: m.publisher.website,
      support_email: m.publisher.supportEmail,
      country: m.publisher.country,
    },
    legal: {
      privacy_policy_url: m.urls.privacyPolicy,
      terms_of_service_url: m.urls.termsOfService,
      security_policy_url: m.urls.security,
    },
    support: {
      url: m.urls.support,
      email: m.publisher.supportEmail,
      status_page: m.urls.statusPage,
    },
    connection: {
      type: "mcp",
      mcp_server_url: m.urls.mcpEndpoint,
      transport: "http",
    },
    auth: {
      oauth2: m.auth.oauth2.enabled
        ? {
            issuer: m.auth.oauth2.issuer,
            authorization_url: m.auth.oauth2.authorizationUrl,
            token_url: m.auth.oauth2.tokenUrl,
            pkce: "required",
            scopes: m.auth.oauth2.scopes,
            resource_indicator: m.urls.baseUrl,
          }
        : null,
      api_key: {
        header: m.auth.apiKey.header,
        scheme: "Bearer",
      },
    },
    pricing: {
      model: "freemium_plus_subscription",
      currency: "JPY",
      plans: m.plans,
      marketplace_billing: false,
      billing_portal_url: `${m.urls.baseUrl}/api/v1/billing/portal`,
    },
    data_handling: m.dataHandling,
    content_rating: "general",
    minimum_api_version: "2024-11-05",
  });
}
