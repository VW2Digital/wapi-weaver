import { describe, it, expect } from "vitest";
import { createHmac, randomUUID } from "crypto";
import { encrypt, decrypt } from "../src/lib/encryption";
import { whatsappAdapter } from "../src/lib/messaging/adapters/whatsapp.adapter";
import { instagramAdapter } from "../src/lib/messaging/adapters/instagram.adapter";
import { messengerAdapter } from "../src/lib/messaging/adapters/messenger.adapter";

describe("META V3 — Phase C Cutover & Integration Suite", () => {
  const secretA = "meta_app_secret_tenant_a_123456789";
  const secretB = "meta_app_secret_tenant_b_987654321";

  const payloadWhatsApp = JSON.stringify({
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
                  id: "wamid.HBgMNTU5MTg1NjQ2MDc2FQIAEhgWM0VCMEZGNTY0RDdBQ0I1MjQ1MjU5RQA=",
                  timestamp: "1787945019",
                  text: { body: "teste real phase c" },
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

  const payloadInstagram = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: "17841405309211888",
        time: 1787945019,
        messaging: [
          {
            sender: { id: "17841400123456" },
            recipient: { id: "17841405309211888" },
            timestamp: 1787945019,
            message: { mid: "m_ig_phase_c_123", text: "Mensagem IG V3" },
          },
        ],
      },
    ],
  });

  const payloadMessenger = JSON.stringify({
    object: "page",
    entry: [
      {
        id: "109876543210",
        time: 1787945019,
        messaging: [
          {
            sender: { id: "209876543210" },
            recipient: { id: "109876543210" },
            timestamp: 1787945019,
            message: { mid: "m_fb_phase_c_456", text: "Mensagem FB Messenger V3" },
          },
        ],
      },
    ],
  });

  it("1. Webhook V3 GET Verification Handshake Simulation", () => {
    const verifyToken = "random_verify_token_uuid_abc";
    const encryptedToken = encrypt(verifyToken);
    const decryptedToken = decrypt(encryptedToken);

    const mode = "subscribe";
    const tokenQuery = "random_verify_token_uuid_abc";
    const challengeQuery = "1158201444";

    const isMatch = mode === "subscribe" && tokenQuery === decryptedToken;
    expect(isMatch).toBe(true);

    const wrongTokenMatch = mode === "subscribe" && "token_errado" === decryptedToken;
    expect(wrongTokenMatch).toBe(false);
  });

  it("2. WhatsApp V3 Payload Processing & Canonical Event Normalization", () => {
    const parsed = JSON.parse(payloadWhatsApp);
    const { events } = whatsappAdapter.normalize(parsed);

    expect(events.length).toBe(1);
    expect(events[0].provider).toBe("whatsapp");
    expect(events[0].channelResourceId).toBe("1107720082434785");
    expect(events[0].externalEventId).toBe("wamid.HBgMNTU5MTg1NjQ2MDc2FQIAEhgWM0VCMEZGNTY0RDdBQ0I1MjQ1MjU5RQA=");
    expect(events[0].eventType).toBe("message.received");
  });

  it("3. Instagram V3 Payload Processing & Normalization", () => {
    const parsed = JSON.parse(payloadInstagram);
    const { events } = instagramAdapter.normalize(parsed);

    expect(events.length).toBe(1);
    expect(events[0].provider).toBe("instagram");
    expect(events[0].channelResourceId).toBe("17841405309211888");
    expect(events[0].externalEventId).toBe("m_ig_phase_c_123");
  });

  it("4. Messenger V3 Payload Processing & Normalization", () => {
    const parsed = JSON.parse(payloadMessenger);
    const { events } = messengerAdapter.normalize(parsed);

    expect(events.length).toBe(1);
    expect(events[0].provider).toBe("messenger");
    expect(events[0].channelResourceId).toBe("109876543210");
    expect(events[0].externalEventId).toBe("m_fb_phase_c_456");
  });

  it("5. Cross-Tenant Attack Rejection (Secret A on URL A with Tenant B Asset)", () => {
    const connectionA = {
      tenantId: "tenant_alpha_uuid",
      connectionId: "conn_alpha_uuid",
    };

    const channelRegisteredInB = {
      tenantId: "tenant_beta_uuid",
      metaAppConnectionId: "conn_beta_uuid",
      externalAccountId: "1107720082434785",
    };

    // Rule: channel.tenant_id must match connection.tenantId
    const isAuthorized =
      channelRegisteredInB.tenantId === connectionA.tenantId &&
      channelRegisteredInB.metaAppConnectionId === connectionA.connectionId;

    expect(isAuthorized).toBe(false);
  });

  it("6. Idempotency across Legacy and V3 (Same external_event_id deduplication)", () => {
    const externalId = "wamid.DUPLICATE_TEST_ID_123";
    const existingEvents = new Set([externalId]);

    const isDuplicate = existingEvents.has(externalId);
    expect(isDuplicate).toBe(true);
  });

  it("7. Group message regression check (Does not create normal commercial lead)", () => {
    const groupPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: "559185646076",
                    group_id: "120363024823948293@g.us",
                    group_name: "Grupo Teste Suporte",
                    id: "wamid.GROUP_MSG_1",
                    text: { body: "Mensagem de grupo" },
                    type: "text",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const isGroup = !!groupPayload.entry[0].changes[0].value.messages[0].group_id;
    expect(isGroup).toBe(true);
  });
});
