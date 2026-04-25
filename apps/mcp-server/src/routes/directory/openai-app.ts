/**
 * /.well-known/openai-app.json — ChatGPT Apps SDK (Apps Store) 向け
 *
 * OpenAI Apps SDK は MCP サーバーを "App" として公開するための新マニフェスト。
 * Claude Connectors と違い app_id / developer / distribution / scopes 等を
 * 厳密に要求するため専用エンドポイントとして分離する。
 *
 * 2026 年改定: Apps SDK 提出フロー (Platform Dashboard) では CSP ・ Demo Recording ・
 * テスト認証情報・Localization などが必須。マニフェスト側では Policy Compliance
 * と Data Handling を明示することで審査を短縮する。
 */
import type { Request, Response } from "express";
import { buildDirectoryMetadata } from "./metadata.js";
import { listPublicOneTimePasses, listPublicPlans } from "@suguvisa/billing";

export function openaiAppHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();

  // サブスクプラン: 月額・年額を明示 / Subscription plans with explicit cycles
  const plans = listPublicPlans().map((p) => ({
    plan_id: p.key,
    display_name: p.name,
    description: p.description,
    price: p.monthlyPriceJpy,
    currency: "JPY",
    billing_cycle: "monthly",
    yearly_price: p.yearlyPriceJpy > 0 ? p.yearlyPriceJpy : null,
    features: {
      ocr: p.features.ocr,
      legal_search: p.features.legal_search,
      bulk_generation: p.features.bulk_generation,
      audit_log: p.features.audit_log,
      annual_report: p.features.annual_report,
      autonomous_workflow: p.features.autonomous_workflow,
    },
    limits: {
      requests_per_minute: p.requestsPerMinute,
      requests_per_day: p.requestsPerDay,
      max_bulk_records: p.maxBulkRecords,
    },
  }));

  // ワンタイム購入 (30日チケット等) / One-time passes (e.g. 30-day ticket)
  const oneTimePasses = listPublicOneTimePasses().map((p) => ({
    plan_id: p.key,
    display_name: p.name,
    description: p.description,
    price: p.priceJpy,
    currency: "JPY",
    billing_cycle: "one_time",
    duration_days: p.durationDays,
    grants_plan: p.grantsPlan,
  }));

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    schema_version: "1.0",
    app_id: m.slug,
    app_version: m.version,
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
      `${m.urls.baseUrl}/assets/screenshot-4.png`,
      `${m.urls.baseUrl}/assets/screenshot-5.png`,
    ],
    developer: {
      name: m.publisher.displayName,
      legal_name: m.publisher.legalName,
      website: m.publisher.website,
      support_email: m.publisher.supportEmail,
      country: m.publisher.country,
      address: m.publisher.address,
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
            dynamic_client_registration: true,
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
      model: "freemium_subscription_with_ticket",
      currency: "JPY",
      trial_days: 14,
      marketplace_billing: false,
      billing_portal_url: `${m.urls.baseUrl}/api/v1/billing/portal`,
      plans,
      one_time_passes: oneTimePasses,
    },
    data_handling: m.dataHandling,
    content_rating: "general",
    // Content Security Policy — Apps SDK 提出要件 (2026 改定)
    // 実際のレスポンスヘッダと一致させ、審査で確認しやすくする
    security: {
      content_security_policy: "default-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://mcp.suguvisa.com https://suguvisa.com; manifest-src 'self'; media-src 'none'; worker-src 'none'; upgrade-insecure-requests",
      hsts: "max-age=63072000; includeSubDomains; preload",
      cors: "GET, POST, DELETE, OPTIONS (Access-Control-Allow-Origin: *)",
      transport_security: "TLS 1.3 (Cloudflare edge + Cloud Run)",
    },
    minimum_api_version: "2024-11-05",
  });
}
