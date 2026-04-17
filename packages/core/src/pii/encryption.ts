/**
 * Envelope encryption の実装
 * Envelope encryption implementations
 * Implementasi enkripsi envelope
 *
 * 本番では Cloud KMS の encryptDek / decryptDek を使用する設計。
 * 本ファイルではローカル開発・テスト用のメモリ内 KMS stub と、
 * Cloud KMS に差し替え可能なインターフェースを提供する。
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import type { EncryptedPayload, PiiCipher } from "./types.js";

/**
 * ローカル開発・テスト専用の KMS stub
 * Local KMS stub for development and tests only.
 * Stub KMS lokal hanya untuk pengembangan dan pengujian.
 *
 * !!! 本番禁止 / DO NOT USE IN PRODUCTION / JANGAN GUNAKAN DI PRODUKSI !!!
 * - テナント ID から決定的に KEK を派生（単なる HKDF 風ハッシュ）
 * - メモリに KEK を保持するだけで KMS 相当の分離がない
 */
export class LocalKmsStub implements PiiCipher {
  constructor(
    private readonly masterSecret: string,
    private readonly kekVersion = "local-v1",
  ) {
    if (!masterSecret || masterSecret.length < 16) {
      throw new Error(
        "LocalKmsStub: masterSecret must be at least 16 characters",
      );
    }
  }

  private deriveKek(tenantId: string): Buffer {
    return createHash("sha256")
      .update(this.masterSecret)
      .update(":")
      .update(tenantId)
      .update(":")
      .update(this.kekVersion)
      .digest();
  }

  async encrypt(
    tenantId: string,
    plaintext: string,
  ): Promise<EncryptedPayload> {
    const kek = this.deriveKek(tenantId);
    const dek = randomBytes(32);
    const iv = randomBytes(12);

    const cipher = createCipheriv("aes-256-gcm", dek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const dekIv = randomBytes(12);
    const dekCipher = createCipheriv("aes-256-gcm", kek, dekIv);
    const wrappedDek = Buffer.concat([
      dekCipher.update(dek),
      dekCipher.final(),
    ]);
    const dekAuthTag = dekCipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString("base64"),
      wrappedDek: Buffer.concat([dekIv, wrappedDek, dekAuthTag]).toString(
        "base64",
      ),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      kekVersion: this.kekVersion,
      algorithm: "AES-256-GCM",
    };
  }

  async decrypt(
    tenantId: string,
    payload: EncryptedPayload,
  ): Promise<string> {
    if (payload.algorithm !== "AES-256-GCM") {
      throw new Error(`Unsupported algorithm: ${payload.algorithm}`);
    }

    const kek = this.deriveKek(tenantId);

    const wrappedDekBuf = Buffer.from(payload.wrappedDek, "base64");
    const dekIv = wrappedDekBuf.subarray(0, 12);
    const dekAuthTag = wrappedDekBuf.subarray(wrappedDekBuf.length - 16);
    const wrappedDekBody = wrappedDekBuf.subarray(
      12,
      wrappedDekBuf.length - 16,
    );

    const dekDecipher = createDecipheriv("aes-256-gcm", kek, dekIv);
    dekDecipher.setAuthTag(dekAuthTag);
    const dek = Buffer.concat([
      dekDecipher.update(wrappedDekBody),
      dekDecipher.final(),
    ]);

    const decipher = createDecipheriv(
      "aes-256-gcm",
      dek,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

/**
 * Cloud KMS 用プレースホルダー実装
 * Cloud KMS placeholder implementation
 * Implementasi placeholder Cloud KMS
 *
 * Phase 4（Pマーク対応）で @google-cloud/kms を用いて差し替える。
 * 現時点では interface のみを公開し、意図的に構築時エラーにする。
 */
export class CloudKmsCipher implements PiiCipher {
  constructor(
    private readonly config: {
      readonly projectId: string;
      readonly location: string;
      readonly keyRingId: string;
      readonly kekNameTemplate: string;
    },
  ) {
    void this.config;
  }

  encrypt(_tenantId: string, _plaintext: string): Promise<EncryptedPayload> {
    return Promise.reject(
      new Error(
        "CloudKmsCipher is not implemented yet; wire up @google-cloud/kms in Phase 4",
      ),
    );
  }

  decrypt(_tenantId: string, _payload: EncryptedPayload): Promise<string> {
    return Promise.reject(
      new Error(
        "CloudKmsCipher is not implemented yet; wire up @google-cloud/kms in Phase 4",
      ),
    );
  }
}
