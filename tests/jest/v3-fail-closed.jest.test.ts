import { describe, expect, it, jest } from "@jest/globals";
import { WhatsAppOutboundAdapter } from "../../src/lib/messaging/outbound/adapters/whatsapp.outbound-adapter";

const mockGetChannel = jest.fn() as jest.Mock<any>;
jest.mock("@/lib/messaging/channel-connection.service", () => ({
  getChannelConnection: (...args: any[]) => mockGetChannel(...args),
  requireActiveChannel: (c: any) => {
    if (c.status !== "active") throw new Error(`Channel ${c.id} is not active (${c.status})`);
  },
}));

describe("V3 fail closed", () => {
  it("fails when the selected WhatsApp channel is not active instead of falling back", async () => {
    mockGetChannel.mockResolvedValue({
      id: "WA_CHANNEL_A",
      tenantId: "t1",
      provider: "whatsapp",
      status: "disconnected",
      externalAccountId: "110000000000",
      accessTokenEncrypted: "TOKEN_A",
    });

    const adapter = new WhatsAppOutboundAdapter();
    await expect(
      adapter.send({
        tenantId: "t1",
        userId: "u1",
        messageId: "m1",
        channelConnectionId: "WA_CHANNEL_A",
        provider: "whatsapp",
        contactPhone: "559100000000",
        type: "text",
        payload: { type: "text", text: { body: "Hello" } },
        metadata: null,
      } as any),
    ).rejects.toThrow("not active");

    expect(mockGetChannel).toHaveBeenCalledWith("WA_CHANNEL_A", "t1");
  });
});
