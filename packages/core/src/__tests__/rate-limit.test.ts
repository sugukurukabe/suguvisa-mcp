/**
 * レート制限ミドルウェアのテスト
 * Tests for rate limit middleware
 * Pengujian middleware pembatasan laju
 */
import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  chainRateLimiters,
  createRateLimiter,
  ipKey,
  principalKey,
  rateLimitPresets,
  tenantKey,
} from "../rate-limit/index.js";

function buildApp(): {
  app: express.Express;
  attachPrincipal: (principal: Record<string, unknown>) => void;
} {
  const app = express();
  app.set("trust proxy", true);
  const state: { principal?: Record<string, unknown> } = {};
  app.use((req, _res, next) => {
    if (state.principal) {
      (req as unknown as { principal: typeof state.principal }).principal =
        state.principal;
    }
    next();
  });
  return {
    app,
    attachPrincipal: (principal) => {
      state.principal = principal;
    },
  };
}

describe("createRateLimiter — global preset (IP-based)", () => {
  it("returns 429 after exceeding max hits from the same IP", async () => {
    const { app } = buildApp();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 3,
        keyGenerator: ipKey,
      }),
    );
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const agent = request.agent(app);
    for (let i = 0; i < 3; i++) {
      const resp = await agent.get("/ping").set("X-Forwarded-For", "1.2.3.4");
      expect(resp.status).toBe(200);
    }

    const blocked = await agent
      .get("/ping")
      .set("X-Forwarded-For", "1.2.3.4");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.error).toBe("rate_limit_exceeded");
    expect(typeof blocked.body.retry_after_seconds).toBe("number");
  });

  it("counts different IPs separately", async () => {
    const { app } = buildApp();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 2,
        keyGenerator: ipKey,
      }),
    );
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 2; i++) {
      await request(app).get("/ping").set("X-Forwarded-For", "1.1.1.1");
    }
    const blocked = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "1.1.1.1");
    expect(blocked.status).toBe(429);

    const differentIp = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "2.2.2.2");
    expect(differentIp.status).toBe(200);
  });

  it("emits standard RateLimit-* headers", async () => {
    const { app } = buildApp();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 5,
        keyGenerator: ipKey,
      }),
    );
    app.get("/ping", (_req, res) => res.json({ ok: true }));

    const resp = await request(app)
      .get("/ping")
      .set("X-Forwarded-For", "3.3.3.3");
    expect(resp.headers["ratelimit-limit"] || resp.headers["ratelimit"]).toBeDefined();
  });
});

describe("createRateLimiter — principalKey", () => {
  it("separates counters per authenticated principal", async () => {
    const { app, attachPrincipal } = buildApp();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 2,
        keyGenerator: principalKey,
      }),
    );
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    attachPrincipal({ sub: "user_a", tenantId: "tenant_a" });
    await request(app).get("/mcp");
    await request(app).get("/mcp");
    const blocked = await request(app).get("/mcp");
    expect(blocked.status).toBe(429);

    attachPrincipal({ sub: "user_b", tenantId: "tenant_a" });
    const otherUser = await request(app).get("/mcp");
    expect(otherUser.status).toBe(200);
  });

  it("falls back to IP when no principal is attached", async () => {
    const { app } = buildApp();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 1,
        keyGenerator: principalKey,
      }),
    );
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await request(app).get("/mcp").set("X-Forwarded-For", "4.4.4.4");
    const blocked = await request(app)
      .get("/mcp")
      .set("X-Forwarded-For", "4.4.4.4");
    expect(blocked.status).toBe(429);
  });
});

describe("createRateLimiter — tenantKey", () => {
  it("shares counters across users in the same tenant", async () => {
    const { app, attachPrincipal } = buildApp();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        max: 2,
        keyGenerator: tenantKey,
      }),
    );
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    attachPrincipal({ sub: "user_a", tenantId: "tenant_a" });
    await request(app).get("/mcp");
    attachPrincipal({ sub: "user_b", tenantId: "tenant_a" });
    await request(app).get("/mcp");

    attachPrincipal({ sub: "user_c", tenantId: "tenant_a" });
    const blocked = await request(app).get("/mcp");
    expect(blocked.status).toBe(429);

    attachPrincipal({ sub: "user_x", tenantId: "tenant_b" });
    const otherTenant = await request(app).get("/mcp");
    expect(otherTenant.status).toBe(200);
  });
});

describe("chainRateLimiters", () => {
  it("requires all limiters to pass", async () => {
    const { app } = buildApp();
    const global = createRateLimiter({
      windowMs: 60_000,
      max: 10,
      keyGenerator: ipKey,
    });
    const perRoute = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyGenerator: ipKey,
    });
    app.use("/mcp", chainRateLimiters(global, perRoute));
    app.get("/mcp", (_req, res) => res.json({ ok: true }));

    await request(app).get("/mcp").set("X-Forwarded-For", "5.5.5.5");
    await request(app).get("/mcp").set("X-Forwarded-For", "5.5.5.5");
    const blocked = await request(app)
      .get("/mcp")
      .set("X-Forwarded-For", "5.5.5.5");
    expect(blocked.status).toBe(429);
  });
});

describe("rateLimitPresets", () => {
  it("exposes sensible defaults", () => {
    expect(rateLimitPresets.global.max).toBe(100);
    expect(rateLimitPresets.global.windowMs).toBe(60_000);
    expect(rateLimitPresets.sensitive.max).toBe(10);
    expect(rateLimitPresets.mcp.max).toBe(60);
    expect(rateLimitPresets.toolCallsPerTenant.max).toBe(1000);
    expect(rateLimitPresets.toolCallsPerTenant.windowMs).toBe(60 * 60 * 1000);
  });
});
