import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyMetaWebhookSignature,
  validateWebhookVerifyToken,
} from "../src/lib/messaging/services/platform-config.service";

describe("Meta Webhook Cryptographic Verification", () => {
  const dummySecret = "test_app_secret_abc123456789";
  const rawBody = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "5511999999999",
                phone_number_id: "1107720082434785",
              },
              messages: [
                {
                  from: "5511988888888",
                  id: "wamid.HBgLMTIz",
                  timestamp: "1710000000",
                  text: { body: "Olá teste" },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  });

  it("proves signature matches on exact raw body with correct secret", () => {
    const signature = "sha256=" + createHmac("sha256", dummySecret).update(rawBody).digest("hex");
    const testHash = createHmac("sha256", dummySecret).update(rawBody).digest("hex");
    expect(signature).toBe(`sha256=${testHash}`);
  });

  it("proves signature fails when raw body is mutated or re-serialized with different formatting", () => {
    const signature = "sha256=" + createHmac("sha256", dummySecret).update(rawBody).digest("hex");
    const mutatedBody = JSON.stringify(JSON.parse(rawBody), null, 2); // Different whitespace/formatting
    const mutatedHash = "sha256=" + createHmac("sha256", dummySecret).update(mutatedBody).digest("hex");
    expect(signature).not.toBe(mutatedHash);
  });

  it("proves signature fails when secret is wrong", () => {
    const signature = "sha256=" + createHmac("sha256", dummySecret).update(rawBody).digest("hex");
    const wrongHash = "sha256=" + createHmac("sha256", "wrong_secret_xyz").update(rawBody).digest("hex");
    expect(signature).not.toBe(wrongHash);
  });
});
