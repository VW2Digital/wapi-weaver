import { describe, it, expect } from "vitest";
import { createHmac, timingSafeEqual } from "crypto";

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

describe("WhatsApp Webhook Signature Verification", () => {
  const appSecret = "test-secret-123";
  const payload = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "123" }] } }] }] });

  it("should return true for a valid signature", async () => {
    const signature = "sha256=" + createHmac("sha256", appSecret).update(payload).digest("hex");
    const result = await verifySignature(payload, signature, appSecret);
    expect(result).toBe(true);
  });

  it("should return false if signature is missing", async () => {
    const result = await verifySignature(payload, null, appSecret);
    expect(result).toBe(false);
  });

  it("should return false if a single byte in the payload is altered", async () => {
    const signature = "sha256=" + createHmac("sha256", appSecret).update(payload).digest("hex");
    // Alter a single character in the payload
    const alteredPayload = payload.replace("123", "124");
    
    const result = await verifySignature(alteredPayload, signature, appSecret);
    expect(result).toBe(false);
  });

  it("should return false if signature does not start with sha256=", async () => {
    const signature = createHmac("sha256", appSecret).update(payload).digest("hex");
    const result = await verifySignature(payload, signature, appSecret);
    expect(result).toBe(false);
  });
});
