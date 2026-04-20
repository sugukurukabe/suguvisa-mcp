/**
 * Directory router tests / ディレクトリルートのテスト / Pengujian router direktori
 *
 * Claude Connectors Directory と ChatGPT Apps Store の審査で確認される
 * manifest / 法務ページ / 静的アセットの出力を Vitest + supertest で検証する。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { createDirectoryRouter } from "../index.js";
import { buildDirectoryMetadata } from "../metadata.js";

function app() {
  const a = express();
  a.use(createDirectoryRouter());
  return a;
}

describe("DirectoryMetadata", () => {
  it("builds a coherent metadata object", () => {
    const m = buildDirectoryMetadata({
      SUGUVISA_BASE_URL: "https://example.test",
      SUGUVISA_SUPPORT_EMAIL: "hello@example.test",
    } as NodeJS.ProcessEnv);
    expect(m.slug).toBe("suguvisa-mcp");
    expect(m.urls.baseUrl).toBe("https://example.test");
    expect(m.urls.mcpEndpoint).toBe("https://example.test/mcp");
    expect(m.urls.privacyPolicy).toBe("https://example.test/privacy");
    expect(m.publisher.supportEmail).toBe("hello@example.test");
    expect(m.displayName.ja).toContain("SuguVisa");
    expect(m.shortDescription.en.length).toBeLessThanOrEqual(200);
    expect(m.plans.length).toBeGreaterThan(0);
    expect(m.dataHandling.subprocessors.length).toBeGreaterThan(0);
    // auth.oauth2.enabled should reflect env presence
    expect(m.auth.oauth2.enabled).toBe(false);
  });

  it("enables oauth2 when AUTH0_DOMAIN is set", () => {
    const m = buildDirectoryMetadata({ AUTH0_DOMAIN: "tenant.auth0.com" } as NodeJS.ProcessEnv);
    expect(m.auth.oauth2.enabled).toBe(true);
    expect(m.auth.oauth2.authorizationUrl).toContain("tenant.auth0.com");
  });
});

describe("/.well-known/mcp/server-card.json", () => {
  it("returns a Claude-compatible server card", async () => {
    const res = await request(app()).get("/.well-known/mcp/server-card.json");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      schemaVersion: expect.any(String),
      protocol: "mcp",
      mcp: expect.objectContaining({ url: expect.stringContaining("/mcp") }),
      serverInfo: expect.objectContaining({
        name: "suguvisa-mcp",
        displayName: expect.any(String),
        displayNameLocalized: expect.objectContaining({ ja: expect.any(String), en: expect.any(String), id: expect.any(String) }),
        icon: expect.stringContaining("/icon-1024.png"),
      }),
      links: expect.objectContaining({
        privacyPolicy: expect.stringContaining("/privacy"),
        termsOfService: expect.stringContaining("/terms"),
        support: expect.stringContaining("/support"),
      }),
      authentication: expect.objectContaining({
        schemes: expect.arrayContaining([expect.objectContaining({ type: "apiKey" })]),
      }),
      dataHandling: expect.objectContaining({
        encryption: expect.any(Object),
        subprocessors: expect.any(Array),
      }),
      plans: expect.any(Array),
    });
  });
});

describe("/.well-known/ai-plugin.json", () => {
  it("returns a GPT plugin manifest", async () => {
    const res = await request(app()).get("/.well-known/ai-plugin.json");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      schema_version: "v1",
      name_for_human: expect.stringContaining("SuguVisa"),
      name_for_model: "suguvisa",
      api: expect.objectContaining({ type: "openapi", url: expect.stringContaining("/openapi.yaml") }),
      logo_url: expect.stringContaining("/icon-1024.png"),
      contact_email: expect.stringContaining("@"),
      legal_info_url: expect.stringContaining("/terms"),
    });
    expect(res.body.description_for_model).toContain("determine_application_type");
  });
});

describe("/.well-known/openai-app.json", () => {
  it("returns an Apps SDK manifest with pricing and legal", async () => {
    const res = await request(app()).get("/.well-known/openai-app.json");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      schema_version: "1.0",
      app_id: "suguvisa-mcp",
      connection: expect.objectContaining({ type: "mcp", transport: "http" }),
      legal: expect.objectContaining({
        privacy_policy_url: expect.stringContaining("/privacy"),
        terms_of_service_url: expect.stringContaining("/terms"),
      }),
      pricing: expect.objectContaining({
        currency: "JPY",
        plans: expect.any(Array),
      }),
      data_handling: expect.any(Object),
    });
  });
});

describe("HTML pages", () => {
  it.each([
    ["/", "SuguVisa"],
    ["/privacy", "プライバシーポリシー"],
    ["/terms", "利用規約"],
    ["/security", "セキュリティ"],
    ["/support", "サポート"],
  ])("%s renders with expected heading", async (path, expected) => {
    const res = await request(app()).get(path);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain(expected);
    expect(res.text).toContain("<!DOCTYPE html>");
    // Meta tags for SEO / review
    expect(res.text).toMatch(/property="og:title"/);
    expect(res.text).toMatch(/rel="canonical"/);
  });

  it("landing page lists plans from the billing catalog", async () => {
    const res = await request(app()).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Free/);
    expect(res.text).toMatch(/Starter/);
    expect(res.text).toMatch(/Professional/);
    expect(res.text).toMatch(/\/api\/v1\/billing\/plans/);
  });

  it("privacy page enumerates all subprocessors", async () => {
    const m = buildDirectoryMetadata();
    const res = await request(app()).get("/privacy");
    for (const sp of m.dataHandling.subprocessors) {
      expect(res.text).toContain(sp.name);
    }
  });
});

describe("Well-known / static endpoints", () => {
  it("security.txt is RFC 9116 shaped", async () => {
    const res = await request(app()).get("/.well-known/security.txt");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^Contact: mailto:.+@.+/m);
    expect(res.text).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
    expect(res.text).toMatch(/^Canonical: https?:/m);
  });

  it("robots.txt and sitemap.xml are served", async () => {
    const robots = await request(app()).get("/robots.txt");
    expect(robots.status).toBe(200);
    expect(robots.text).toContain("Sitemap:");

    const sitemap = await request(app()).get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain("<urlset");
    expect(sitemap.text).toContain("/privacy");
  });

  it("logo and favicon SVGs are served", async () => {
    const logo = await request(app()).get("/logo.svg").buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(logo.status).toBe(200);
    expect(logo.headers["content-type"]).toMatch(/image\/svg\+xml/);
    expect((logo.body as Buffer).toString("utf8")).toContain("<svg");
  });
});
