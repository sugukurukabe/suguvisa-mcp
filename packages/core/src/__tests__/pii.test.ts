/**
 * Pii<T> ラッパーのテスト
 * Tests for Pii<T> wrapper including audit emission
 * Pengujian pembungkus Pii<T> termasuk pemancaran audit
 */
import { describe, expect, it } from "vitest";
import { inspect } from "node:util";
import { InMemoryAuditLogger } from "../pii/audit.js";
import { Pii, isPii, pii } from "../pii/pii.js";
import type { AuditContext } from "../pii/types.js";

const auditCtx: AuditContext = {
  actor: "user_abc",
  tenantId: "tenant_sugukuru",
  reason: "申請書類生成のため",
};

describe("Pii wrapper", () => {
  it("masks via toString()", () => {
    const card = pii.residenceCard("AB12345678CD");
    expect(String(card)).toBe("AB**********");
  });

  it("masks via JSON serialization", () => {
    const card = pii.residenceCard("AB12345678CD");
    const serialized = JSON.stringify({ residenceCard: card });
    const parsed = JSON.parse(serialized);
    expect(parsed.residenceCard.masked).toBe("AB**********");
    expect(parsed.residenceCard.kind).toBe("residence_card");
    expect(JSON.stringify(parsed)).not.toContain("12345678");
  });

  it("masks via util.inspect", () => {
    const card = pii.residenceCard("AB12345678CD");
    const inspected = inspect(card);
    expect(inspected).toContain("Pii<residence_card>");
    expect(inspected).toContain("AB**********");
    expect(inspected).not.toContain("12345678");
  });

  it("does not expose plaintext on property access", () => {
    const card = pii.residenceCard("AB12345678CD");
    const keys = Object.keys(card);
    for (const k of keys) {
      expect(String((card as unknown as Record<string, unknown>)[k])).not.toContain(
        "12345678",
      );
    }
  });

  it("unmasks plaintext with audit context", () => {
    const logger = new InMemoryAuditLogger();
    const card = pii.residenceCard("AB12345678CD", logger);
    expect(card.unmask(auditCtx)).toBe("AB12345678CD");
    expect(logger.getEvents()).toHaveLength(1);
    const event = logger.getEvents()[0];
    expect(event.actor).toBe("user_abc");
    expect(event.tenantId).toBe("tenant_sugukuru");
    expect(event.reason).toBe("申請書類生成のため");
    expect(event.piiKind).toBe("residence_card");
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("accepts provided timestamp", () => {
    const logger = new InMemoryAuditLogger();
    const fixed = new Date("2026-04-17T00:00:00.000Z");
    const name = pii.name("田中太郎", logger);
    name.unmask({ ...auditCtx, timestamp: fixed });
    expect(logger.getEvents()[0].timestamp).toEqual(fixed);
  });

  it("works without logger attached", () => {
    const card = pii.residenceCard("AB12345678CD");
    expect(() => card.unmask(auditCtx)).not.toThrow();
  });

  it("isPii type guard", () => {
    expect(isPii(pii.name("田中"))).toBe(true);
    expect(isPii("plain string")).toBe(false);
    expect(isPii(null)).toBe(false);
    expect(isPii(undefined)).toBe(false);
    expect(isPii({ mask: () => "x" })).toBe(false);
  });

  it("withAuditLogger returns a new Pii", () => {
    const logger1 = new InMemoryAuditLogger();
    const logger2 = new InMemoryAuditLogger();
    const original = pii.name("田中", logger1);
    const cloned = original.withAuditLogger(logger2);

    cloned.unmask(auditCtx);
    expect(logger1.getEvents()).toHaveLength(0);
    expect(logger2.getEvents()).toHaveLength(1);
  });

  it("empty PII values are detected", () => {
    expect(pii.email("").isEmpty()).toBe(true);
    expect(pii.email("a@b.jp").isEmpty()).toBe(false);
  });

  it("supports all PII kinds via factory", () => {
    expect(pii.name("田中").kind).toBe("name");
    expect(pii.nameKana("たなか").kind).toBe("name_kana");
    expect(pii.residenceCard("AB").kind).toBe("residence_card");
    expect(pii.passport("TK").kind).toBe("passport");
    expect(pii.dob("1990-01-01").kind).toBe("dob");
    expect(pii.address("東京").kind).toBe("address");
    expect(pii.phone("090").kind).toBe("phone");
    expect(pii.email("a@b.jp").kind).toBe("email");
    expect(pii.corporateId("12345").kind).toBe("corporate_id");
    expect(pii.myNumber("123").kind).toBe("my_number");
    expect(pii.bankAccount("123").kind).toBe("bank_account");
    expect(pii.generic("foo").kind).toBe("generic");
  });

  it("direct constructor with custom kind", () => {
    const value = new Pii("test@example.com", "email");
    expect(value.mask()).toBe("t***@example.com");
    expect(value.kind).toBe("email");
  });
});
