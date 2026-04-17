/**
 * envelope encryption のテスト
 * Tests for envelope encryption
 * Pengujian enkripsi envelope
 */
import { describe, expect, it } from "vitest";
import { CloudKmsCipher, LocalKmsStub } from "../pii/encryption.js";

describe("LocalKmsStub", () => {
  const kms = new LocalKmsStub(
    "master-secret-for-tests-only-32chars!",
    "test-v1",
  );

  it("round-trips plaintext", async () => {
    const payload = await kms.encrypt("tenant_a", "AB12345678CD");
    expect(payload.algorithm).toBe("AES-256-GCM");
    expect(payload.kekVersion).toBe("test-v1");
    expect(payload.ciphertext).not.toContain("AB12345678CD");

    const plaintext = await kms.decrypt("tenant_a", payload);
    expect(plaintext).toBe("AB12345678CD");
  });

  it("produces different ciphertext for same plaintext (random IV)", async () => {
    const [p1, p2] = await Promise.all([
      kms.encrypt("tenant_a", "same-value"),
      kms.encrypt("tenant_a", "same-value"),
    ]);
    expect(p1.ciphertext).not.toBe(p2.ciphertext);
    expect(p1.iv).not.toBe(p2.iv);
  });

  it("prevents cross-tenant decryption", async () => {
    const payload = await kms.encrypt("tenant_a", "secret");
    await expect(kms.decrypt("tenant_b", payload)).rejects.toThrow();
  });

  it("detects tampered ciphertext", async () => {
    const payload = await kms.encrypt("tenant_a", "secret");
    const tampered = {
      ...payload,
      ciphertext: Buffer.from("corrupted").toString("base64"),
    };
    await expect(kms.decrypt("tenant_a", tampered)).rejects.toThrow();
  });

  it("handles unicode plaintext", async () => {
    const input = "田中太郎 🇯🇵 ABC";
    const payload = await kms.encrypt("tenant_a", input);
    expect(await kms.decrypt("tenant_a", payload)).toBe(input);
  });

  it("rejects weak master secret", () => {
    expect(() => new LocalKmsStub("short")).toThrow();
  });

  it("rejects unsupported algorithm on decrypt", async () => {
    const payload = await kms.encrypt("tenant_a", "secret");
    const mutated = {
      ...payload,
      algorithm: "AES-128-CBC" as never,
    };
    await expect(kms.decrypt("tenant_a", mutated)).rejects.toThrow(
      /Unsupported algorithm/,
    );
  });
});

describe("CloudKmsCipher placeholder", () => {
  const kms = new CloudKmsCipher({
    projectId: "mcp-service-492010",
    location: "asia-northeast1",
    keyRingId: "suguvisa-pii",
    kekNameTemplate: "tenant-{tenantId}",
  });

  it("rejects encrypt with not-implemented error", async () => {
    await expect(kms.encrypt("tenant_a", "x")).rejects.toThrow(
      /not implemented/,
    );
  });

  it("rejects decrypt with not-implemented error", async () => {
    await expect(
      kms.decrypt("tenant_a", {
        ciphertext: "",
        wrappedDek: "",
        iv: "",
        authTag: "",
        kekVersion: "",
        algorithm: "AES-256-GCM",
      }),
    ).rejects.toThrow(/not implemented/);
  });
});
