/// <reference types="jest" />
import { whatsappAdapter } from "@/lib/messaging/adapters/whatsapp.adapter";
import { instagramAdapter } from "@/lib/messaging/adapters/instagram.adapter";
import { messengerAdapter } from "@/lib/messaging/adapters/messenger.adapter";

describe("Messaging Adapters", () => {
  describe("whatsappAdapter", () => {
    it("normalizes a simple text message", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "5511999999999",
                    phone_number_id: "PHONE_ID",
                  },
                  contacts: [{ wa_id: "5511888888888", profile: { name: "John" } }],
                  messages: [
                    {
                      id: "wamid.123",
                      from: "5511888888888",
                      timestamp: "1699999999",
                      type: "text",
                      text: { body: "Hello" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const { events } = whatsappAdapter.normalize(payload);

      expect(events).toHaveLength(1);
      expect(events[0].provider).toBe("whatsapp");
      expect(events[0].eventType).toBe("message.received");
      expect(events[0].externalEventId).toBe("wamid.123");
      expect(events[0].channelResourceId).toBe("PHONE_ID");
      expect(events[0].payload).toMatchObject({
        providerMessageId: "wamid.123",
        direction: "incoming",
        type: "text",
        body: "Hello",
      });
    });

    it("ignores messages missing id or sender", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "PHONE_ID" },
                  messages: [{ type: "text", text: { body: "Orphan" } }],
                },
              },
            ],
          },
        ],
      };

      const { events, diagnostics } = whatsappAdapter.normalize(payload);

      expect(events).toHaveLength(0);
      expect(diagnostics?.reasons?.length).toBeGreaterThan(0);
    });

    it("normalizes a status update (delivered)", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "PHONE_ID" },
                  statuses: [
                    {
                      id: "wamid.123",
                      status: "delivered",
                      timestamp: "1699999999",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const { events } = whatsappAdapter.normalize(payload);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("message.status");
      const statusPayload = events[0].payload as { status: string };
      expect(statusPayload.status).toBe("delivered");
    });

    it("normalizes an outgoing message echo (sent)", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_ID",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { phone_number_id: "PHONE_ID" },
                  message_echoes: [
                    {
                      id: "wamid.echo",
                      to: "5511888888888",
                      timestamp: "1699999999",
                      type: "text",
                      text: { body: "Echo" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const { events } = whatsappAdapter.normalize(payload);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("message.echo");
      const echoPayload = events[0].payload as { direction: string };
      expect(echoPayload.direction).toBe("outgoing");
    });
  });

  describe("instagramAdapter", () => {
    it("normalizes a direct message", () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "PAGE_ID",
            time: 1699999999,
            messaging: [
              {
                sender: { id: "SENDER_IG_ID" },
                recipient: { id: "PAGE_ID" },
                timestamp: 1699999999,
                message: { mid: "mid.123", text: "Oi" },
              },
            ],
          },
        ],
      };

      const { events } = instagramAdapter.normalize(payload);

      expect(events).toHaveLength(1);
      expect(events[0].provider).toBe("instagram");
      expect(events[0].eventType).toBe("message.received");
      expect(events[0].externalEventId).toBe("mid.123");
      expect(events[0].channelResourceId).toBe("PAGE_ID");
    });

    it("attributes an echo to the recipient contact instead of the business account", () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "BUSINESS_IG_ID",
            messaging: [
              {
                sender: { id: "BUSINESS_IG_ID" },
                recipient: { id: "CONTACT_IG_ID" },
                timestamp: 1699999999,
                message: { mid: "mid.echo", text: "Resposta", is_echo: true },
              },
            ],
          },
        ],
      };

      const { events } = instagramAdapter.normalize(payload);
      const message = events[0].payload as {
        direction: string;
        sender: { externalId: string; metadata?: { recipientId?: string } };
        recipient: { externalId: string };
      };

      expect(events[0].eventType).toBe("message.echo");
      expect(message.direction).toBe("outgoing");
      expect(message.sender.externalId).toBe("CONTACT_IG_ID");
      expect(message.sender.metadata?.recipientId).toBe("BUSINESS_IG_ID");
      expect(message.recipient.externalId).toBe("BUSINESS_IG_ID");
    });
  });

  describe("messengerAdapter", () => {
    it("normalizes a direct message", () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "PAGE_ID",
            time: 1699999999,
            messaging: [
              {
                sender: { id: "SENDER_PSID" },
                recipient: { id: "PAGE_ID" },
                timestamp: 1699999999,
                message: { mid: "mid.456", text: "Hello" },
              },
            ],
          },
        ],
      };

      const { events } = messengerAdapter.normalize(payload);

      expect(events).toHaveLength(1);
      expect(events[0].provider).toBe("messenger");
      expect(events[0].eventType).toBe("message.received");
      expect(events[0].externalEventId).toBe("mid.456");
      expect(events[0].payload).toMatchObject({
        direction: "incoming",
        sender: { externalId: "SENDER_PSID" },
        recipient: { externalId: "PAGE_ID" },
      });
    });

    it("maps page echoes to the contact PSID, not the page id", () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "PAGE_ID",
            messaging: [
              {
                sender: { id: "PAGE_ID" },
                recipient: { id: "SENDER_PSID" },
                timestamp: 1699999999,
                message: { mid: "mid.echo", text: "Resposta", is_echo: true },
              },
            ],
          },
        ],
      };

      const { events } = messengerAdapter.normalize(payload);
      const message = events[0].payload as {
        direction: string;
        sender: { externalId: string; metadata?: { recipientId?: string } };
        recipient: { externalId: string };
      };

      expect(events[0].eventType).toBe("message.echo");
      expect(message.direction).toBe("outgoing");
      expect(message.sender.externalId).toBe("SENDER_PSID");
      expect(message.sender.metadata?.recipientId).toBe("PAGE_ID");
      expect(message.recipient.externalId).toBe("PAGE_ID");
    });
  });
});
