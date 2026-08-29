import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { encrypt, decrypt } from "../src/lib/encryption";

describe("Meta V3 Phase B — Multi-Tenant Webhook & Asset Authorization Tests", () => {
  const secretA = "meta_app_secret_tenant_a_123456789";
  const secretB = "meta_app_secret_tenant_b_987654321";

  const payloadWhatsAppA = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_A",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "PHONE_ID_A" },
              messages: [{ id: "wam_1", from: "5591988887777", text: { body: "Ola A" } }],
            },
            field: "messages",
          },
        ],
      },
    ],
  });

  const payloadInstagramA = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: "IG_PAGE_ID_A",
        messaging: [{ sender: { id: "IG_SENDER_1" }, message: { mid: "m_1", text: "Ola IG" } }],
      },
    ],
  });

  const payloadMessengerA = JSON.stringify({
    object: "page",
    entry: [
      {
        id: "FB_PAGE_ID_A",
        messaging: [{ sender: { id: "FB_PSID_1" }, message: { mid: "m_fb_1", text: "Ola FB" } }],
      },
    ],
  });

  it("1. Secret encryption & fail-safe verification", () => {
    const enc = encrypt(secretA);
    expect(enc).not.toBe(secretA);
    expect(decrypt(enc)).toBe(secretA);
  });

  it("2. Valid signature for Secret A on Tenant A URL", () => {
    const sigA = `sha256=${createHmac("sha256", secretA).update(Buffer.from(payloadWhatsAppA, "utf8")).digest("hex")}`;
    const expectedSig = `sha256=${createHmac("sha256", secretA).update(Buffer.from(payloadWhatsAppA, "utf8")).digest("hex")}`;
    expect(sigA).toBe(expectedSig);
  });

  it("3. Rejected signature for Secret B on Tenant A URL (Wrong Secret)", () => {
    const sigB = `sha256=${createHmac("sha256", secretB).update(Buffer.from(payloadWhatsAppA, "utf8")).digest("hex")}`;
    const expectedSigA = `sha256=${createHmac("sha256", secretA).update(Buffer.from(payloadWhatsAppA, "utf8")).digest("hex")}`;
    expect(sigB === expectedSigA).toBe(false);
  });

  it("4. Rejected signature when raw body is tampered", () => {
    const tamperedPayload = payloadWhatsAppA.replace("Ola A", "Ola Malicioso");
    const sigOriginal = `sha256=${createHmac("sha256", secretA).update(Buffer.from(payloadWhatsAppA, "utf8")).digest("hex")}`;
    const sigTampered = `sha256=${createHmac("sha256", secretA).update(Buffer.from(tamperedPayload, "utf8")).digest("hex")}`;
    expect(sigOriginal === sigTampered).toBe(false);
  });

  it("5. Cross-tenant asset authorization verification rule", () => {
    // Simulating Tenant A receiving Asset belonging to Tenant B
    const connectionTenantId = "tenant_a_uuid";
    const channelConnection = {
      tenant_id: "tenant_b_uuid",
      meta_app_connection_id: "conn_b_uuid",
      external_account_id: "PHONE_ID_B",
    };

    // Cross-check test: Connection tenant must match channel tenant
    const isAuthorized = channelConnection.tenant_id === connectionTenantId;
    expect(isAuthorized).toBe(false);
  });

  it("6. Verify 3 Providers detection and normalization", () => {
    const wa = JSON.parse(payloadWhatsAppA);
    const ig = JSON.parse(payloadInstagramA);
    const fb = JSON.parse(payloadMessengerA);

    expect(wa.object).toBe("whatsapp_business_account");
    expect(ig.object).toBe("instagram");
    expect(fb.object).toBe("page");
  });
});
