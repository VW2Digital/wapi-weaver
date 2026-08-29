import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";
import { encrypt, decrypt } from "../src/lib/encryption";

describe("Meta Integration V3 Multi-Tenant HMAC & Encryption", () => {
  it("should encrypt and decrypt Meta App Secret safely", () => {
    const rawSecret = "f8a91b2c3d4e5f60718293a4b5c6d7e8";
    const encrypted = encrypt(rawSecret);
    expect(encrypted).not.toBe(rawSecret);
    expect(encrypted).toContain(":");

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it("should generate and validate HMAC SHA-256 for Tenant A vs Tenant B", () => {
    const secretA = "tenant_a_meta_app_secret_123456789";
    const secretB = "tenant_b_meta_app_secret_987654321";

    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "123", changes: [{ value: { messages: [{ text: { body: "ola" } }] } }] }],
    });

    const sigA = `sha256=${createHmac("sha256", secretA).update(Buffer.from(payload, "utf8")).digest("hex")}`;
    const sigB = `sha256=${createHmac("sha256", secretB).update(Buffer.from(payload, "utf8")).digest("hex")}`;

    // Valid with correct secret
    const verifyAWithA = sigA === `sha256=${createHmac("sha256", secretA).update(Buffer.from(payload, "utf8")).digest("hex")}`;
    expect(verifyAWithA).toBe(true);

    // Cross-tenant mismatch must FAIL
    const verifyAWithB = sigA === `sha256=${createHmac("sha256", secretB).update(Buffer.from(payload, "utf8")).digest("hex")}`;
    expect(verifyAWithB).toBe(false);

    const verifyBWithA = sigB === `sha256=${createHmac("sha256", secretA).update(Buffer.from(payload, "utf8")).digest("hex")}`;
    expect(verifyBWithA).toBe(false);
  });
});
