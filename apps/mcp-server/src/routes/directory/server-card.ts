/**
 * /.well-known/mcp/server-card.json — Claude Connectors Directory 向け
 *
 * Anthropic の MCP Connector レビューでは、単なる旧 "server-card" だけでなく、
 * アイコン URL / カテゴリ / プライバシー・利用規約 / 連絡先 / スコープ / データの扱い
 * までを確認される。DirectoryMetadata を単一ソースに、Claude 審査で求められる
 * 主要フィールドをすべて埋めたカードを返す。
 */
import type { Request, Response } from "express";
import { buildDirectoryMetadata } from "./metadata.js";

export function serverCardHandler(_req: Request, res: Response): void {
  const m = buildDirectoryMetadata();

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    schemaVersion: "1.0",
    protocol: "mcp",
    mcp: {
      url: m.urls.mcpEndpoint,
      transport: ["http", "stdio"],
      protocolVersion: "2024-11-05",
    },
    serverInfo: {
      name: m.slug,
      displayName: m.displayName.en,
      displayNameLocalized: m.displayName,
      description: m.shortDescription.en,
      descriptionLocalized: m.shortDescription,
      longDescription: m.longDescription.en,
      longDescriptionLocalized: m.longDescription,
      version: m.version,
      categories: m.categories,
      tags: m.tags,
      icon: m.urls.logo,
      ogImage: m.urls.ogImage,
    },
    publisher: m.publisher,
    links: {
      website: m.urls.website,
      privacyPolicy: m.urls.privacyPolicy,
      termsOfService: m.urls.termsOfService,
      security: m.urls.security,
      support: m.urls.support,
      documentation: m.urls.documentation,
      status: m.urls.statusPage,
    },
    authentication: {
      // Claude Connectors expects a structured list of available schemes
      schemes: [
        ...(m.auth.oauth2.enabled
          ? [
              {
                type: "oauth2",
                flow: "authorization_code",
                issuer: m.auth.oauth2.issuer,
                authorizationUrl: m.auth.oauth2.authorizationUrl,
                tokenUrl: m.auth.oauth2.tokenUrl,
                pkce: "required",
                scopes: m.auth.oauth2.scopes,
                resourceIndicator: m.urls.baseUrl,
              },
            ]
          : []),
        {
          type: "apiKey",
          in: "header",
          name: m.auth.apiKey.header,
          scheme: "Bearer",
          example: m.auth.apiKey.example,
        },
      ],
    },
    configSchema: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          title: "Subscription Plan",
          description:
            "Select your subscription tier. free=5 basic tools, starter=all visa tools, professional=OCR+bulk+audit.",
          default: "free",
          enum: ["free", "starter", "professional"],
        },
        apiKey: {
          type: "string",
          title: "API Key",
          description: "API key from https://suguvisa.com/dashboard/api-keys",
          default: "",
          format: "password",
          "x-from": { header: "x-suguvisa-api-key" },
        },
        gcpProjectId: {
          type: "string",
          title: "GCP Project ID (optional)",
          description: "Required only if you want residence card OCR with your own GCP quota.",
          default: "",
        },
      },
      required: [],
    },
    dataHandling: m.dataHandling,
    plans: m.plans,
    compliance: {
      appi: true,
      gdpr: false,
      soc2: "in_progress",
      dataResidency: m.dataHandling.regions,
    },
  });
}
