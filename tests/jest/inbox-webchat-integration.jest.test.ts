import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { randomUUID } from "crypto";
import { findConversationByContactPhone } from "@/lib/messaging/conversation-channel.service";
import { providerDispatcher } from "@/lib/messaging/outbound/provider-dispatcher";
import { WebChatOutboundAdapter } from "@/lib/messaging/outbound/adapters/webchat-outbound-adapter";

const TENANT_ID = "tenant-webchat-test";
const SESSION_ID = "session-webchat-1";
const CHANNEL_ID = "channel-webchat-1";
const EXTERNAL_ID = "visitor-123";

const mockedDb = jest.fn(async (sql: string, params: unknown[]) => {
  if (sql.includes("FROM chat_sessions cs")) {
    const contactPhone = params[1] as string;
    if (contactPhone === `wc_${EXTERNAL_ID}`) {
      return [{ id: SESSION_ID, channel_connection_id: CHANNEL_ID }];
    }
    return [];
  }
  return [];
});

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    query: (...args: [string, unknown[]]) => mockedDb(...args),
  },
}));

jest.mock("@/lib/cache", () => ({
  redis: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => {}),
  },
}));

describe("Inbox WebChat integration", () => {
  beforeEach(() => {
    mockedDb.mockClear();
  });

  describe("conversation resolution", () => {
    test("finds WebChat conversation by wc_ identifier without phone_e164", async () => {
      const result = await findConversationByContactPhone(TENANT_ID, `wc_${EXTERNAL_ID}`);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(SESSION_ID);
      expect(result?.channelConnectionId).toBe(CHANNEL_ID);
    });

    test("does not find conversation with invalid visitor id", async () => {
      const result = await findConversationByContactPhone(TENANT_ID, "wc_invalid");
      expect(result).toBeNull();
    });
  });

  describe("provider routing", () => {
    test("dispatches WebChat outbound through WebChatOutboundAdapter", async () => {
      const dispatchSpy = jest.spyOn(WebChatOutboundAdapter.prototype, "send").mockResolvedValue({
        provider: "webchat",
        providerMessageId: "webchat-message-id",
        providerAccountId: null,
        status: "sent",
        responsePayload: null,
      });

      try {
        const message = await providerDispatcher.dispatch({
          tenantId: TENANT_ID,
          userId: TENANT_ID,
          messageId: randomUUID(),
          contactPhone: `wc_${EXTERNAL_ID}`,
          provider: "webchat",
          channelConnectionId: CHANNEL_ID,
          conversationId: SESSION_ID,
          providerRecipientId: null,
          providerAccountId: null,
          type: "text",
          replyToMessageId: null,
          metadata: null,
          payload: { type: "text", text: { body: "Resposta humana" } },
        });

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(message.provider).toBe("webchat");
        expect(message.providerMessageId).toBe("webchat-message-id");
      } finally {
        dispatchSpy.mockRestore();
      }
    });
  });
});
