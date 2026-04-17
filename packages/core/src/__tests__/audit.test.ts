/**
 * 監査ロガーのテスト
 * Tests for audit loggers
 * Pengujian logger audit
 */
import { describe, expect, it, vi } from "vitest";
import {
  CallbackAuditLogger,
  CompositeAuditLogger,
  InMemoryAuditLogger,
} from "../pii/audit.js";
import type { PiiAuditEvent } from "../pii/types.js";

const sampleEvent: PiiAuditEvent = {
  actor: "user_abc",
  tenantId: "tenant_a",
  reason: "test",
  piiKind: "name",
  timestamp: new Date("2026-04-17T00:00:00.000Z"),
};

describe("InMemoryAuditLogger", () => {
  it("records events", () => {
    const logger = new InMemoryAuditLogger();
    logger.logUnmask(sampleEvent);
    logger.logUnmask({ ...sampleEvent, piiKind: "passport" });
    expect(logger.getEvents()).toHaveLength(2);
  });

  it("clears events", () => {
    const logger = new InMemoryAuditLogger();
    logger.logUnmask(sampleEvent);
    logger.clear();
    expect(logger.getEvents()).toHaveLength(0);
  });

  it("returns a copy, not the original array", () => {
    const logger = new InMemoryAuditLogger();
    logger.logUnmask(sampleEvent);
    const snapshot = logger.getEvents();
    logger.logUnmask(sampleEvent);
    expect(snapshot).toHaveLength(1);
    expect(logger.getEvents()).toHaveLength(2);
  });
});

describe("CallbackAuditLogger", () => {
  it("invokes the callback", async () => {
    const handler = vi.fn();
    const logger = new CallbackAuditLogger(handler);
    await logger.logUnmask(sampleEvent);
    expect(handler).toHaveBeenCalledWith(sampleEvent);
  });

  it("awaits async callbacks", async () => {
    let resolved = false;
    const handler = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      resolved = true;
    });
    const logger = new CallbackAuditLogger(handler);
    await logger.logUnmask(sampleEvent);
    expect(resolved).toBe(true);
  });
});

describe("CompositeAuditLogger", () => {
  it("fans out to every logger", async () => {
    const a = new InMemoryAuditLogger();
    const b = new InMemoryAuditLogger();
    const composite = new CompositeAuditLogger([a, b]);
    await composite.logUnmask(sampleEvent);
    expect(a.getEvents()).toHaveLength(1);
    expect(b.getEvents()).toHaveLength(1);
  });
});
