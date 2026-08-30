import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { buildEventBase } from "../../src/lib/messaging/adapters/base.adapter";
import { ensureConversation } from "../../src/lib/messaging/services/conversation.service";
import { saveMessage } from "../../src/lib/messaging/services/message.service";

const mockDb = jest.fn() as jest.Mock<any>;
const mockConn = { execute: mockDb, query: mockDb };
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: any[]) => mockDb(...args) },
  transaction: (fn: any) => fn(mockConn),
}));

describe("Inbound channel propagation", () => {
  beforeEach(() => { mockDb.mockReset(); });

  it("canonical event carries channelConnectionId and metaAppConnectionId", () => {
    const event = buildEventBase(
      "whatsapp",
      "T1",
      "message.received",
      "wamid.123",
      "1107720082434785",
      { providerMessageId: "wamid.123" },
      {},
      {
        channelConnectionId: "WA_CHANNEL_1",
        metaAppConnectionId: "META_APP_1",
      },
    );

    expect(event.channelConnectionId).toBe("WA_CHANNEL_1");
    expect(event.metaAppConnectionId).toBe("META_APP_1");
  });

  it("ensureConversation persists channelConnectionId", async () => {
    mockDb
      .mockResolvedValueOnce([[]]) // no existing
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await ensureConversation({
      tenantId: "T1",
      userId: "U1",
      contactId: "C1",
      channelConnectionId: "WA_CHANNEL_1",
    });

    expect(result.isNew).toBe(true);
    const insertCall = mockDb.mock.calls[1];
    expect(insertCall[1]).toContain("WA_CHANNEL_1");
  });

  it("saveMessage persists channelConnectionId and conversationId", async () => {
    mockDb
      .mockResolvedValueOnce([[]]) // no existing
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await saveMessage({
      tenantId: "T1",
      userId: "U1",
      contactId: "C1",
      conversationId: "CONV_1",
      contactPhone: "559100000000",
      provider: "whatsapp",
      channelResourceId: "1107720082434785",
      channelConnectionId: "WA_CHANNEL_1",
      message: {
        providerMessageId: "wamid.123",
        direction: "incoming",
        type: "text",
        body: "Hello",
        sender: { externalId: "559100000000" },
        recipient: { externalId: "1107720082434785" },
      } as any,
    });

    const insertCall = mockDb.mock.calls[1];
    const values = insertCall[1] as any[];
    expect(values).toContain("CONV_1");
    expect(values).toContain("WA_CHANNEL_1");
  });
});
