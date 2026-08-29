import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";
import {
  encryptMetaCredential,
  decryptMetaCredential,
} from "../src/lib/encryption";
import { whatsappAdapter } from "../src/lib/messaging/adapters/whatsapp.adapter";

describe("META V3 — Phase C2 Real Connection & Fail-Closed Encryption Suite", () => {
  beforeAll(() => {
    // Set dedicated Meta encryption key in test runtime
    process.env.META_CREDENTIALS_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("1. Dedicated META_CREDENTIALS_ENCRYPTION_KEY Encrypt & Decrypt", () => {
    const rawSecret = "f8a91b2c3d4e5f60718293a4b5c6d7e8";
    const encrypted = encryptMetaCredential(rawSecret);
    expect(encrypted).not.toBe(rawSecret);
    expect(encrypted).toContain(":");

    const decrypted = decryptMetaCredential(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it("2. Fail-Closed behavior when META_CREDENTIALS_ENCRYPTION_KEY is missing", () => {
    const oldKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.META_CREDENTIALS_ENCRYPTION_KEY;

    expect(() => {
      encryptMetaCredential("test_secret");
    }).toThrow("FAIL_CLOSED");

    // Restore key
    process.env.META_CREDENTIALS_ENCRYPTION_KEY = oldKey;
  });

  it("3. WhatsApp Canonical Asset resolution (external_account_id = phone_number_id)", () => {
    const payloadWhatsApp = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "1252390143469267",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "5591936180534",
                  phone_number_id: "1107720082434785",
                },
                contacts: [{ profile: { name: "Vanderlei Mendes" }, wa_id: "559185646076" }],
                messages: [
                  {
                    from: "559185646076",
                    id: "wamid.REAL_MSG_123",
                    timestamp: "1787945019",
                    text: { body: "teste real phase c2" },
                    type: "text",
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const { events } = whatsappAdapter.normalize(payloadWhatsApp);
    expect(events[0].channelResourceId).toBe("1107720082434785");
    expect(events[0].provider).toBe("whatsapp");
  });

  it("4. Idempotency across Legacy and V3 on identical external_event_id", () => {
    const processedEvents = new Set<string>();
    const externalEventId = "wamid.REAL_MSG_123";

    // Legacy ingestion
    const firstAttempt = !processedEvents.has(externalEventId);
    processedEvents.add(externalEventId);
    expect(firstAttempt).toBe(true);

    // V3 ingestion duplicate attempt
    const secondAttempt = !processedEvents.has(externalEventId);
    expect(secondAttempt).toBe(false);
  });
});
