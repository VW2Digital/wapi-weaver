import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { WhatsAppOutboundAdapter } from "../../src/lib/messaging/outbound/adapters/whatsapp.outbound-adapter";
import { InstagramOutboundAdapter } from "../../src/lib/messaging/outbound/adapters/instagram.outbound-adapter";

const mockGetChannel = jest.fn() as jest.Mock<any>;
const mockRequireActive = jest.fn((c: any) => {
  if (c.status !== "active") throw new Error("channel not active");
});

jest.mock("@/lib/messaging/channel-connection.service", () => ({
  getChannelConnection: (...args: any[]) => mockGetChannel(...args),
  requireActiveChannel: (c: any) => mockRequireActive(c),
  resolveChannelAccessToken: (c: any) => c.accessTokenEncrypted ?? "",
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

describe("Deterministic channel routing", () => {
  beforeEach(() => {
    mockGetChannel.mockReset();
    mockRequireActive.mockReset();
  });

  it("WhatsApp adapter resolves exact channel by channelConnectionId", async () => {
    mockGetChannel.mockResolvedValue({
      id: "WA_CHANNEL_1",
      tenantId: "t1",
      provider: "whatsapp",
      status: "active",
      externalAccountId: "1107720082434785",
      accessTokenEncrypted: "WA_TOKEN_1",
    });

    const fakeFetch = jest.fn<(url: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ wa_id: "559193801288" }],
          messages: [{ id: "wamid.ABC" }],
        }),
    } as unknown as Response);
    (global as any).fetch = fakeFetch;

    const adapter = new WhatsAppOutboundAdapter();
    const result = await adapter.send({
      tenantId: "t1",
      userId: "u1",
      messageId: "m1",
      channelConnectionId: "WA_CHANNEL_1",
      provider: "whatsapp",
      contactPhone: "559193801288",
      type: "text",
      payload: { type: "text", text: { body: "Hello" } },
      metadata: null,
    } as any);

    expect(result.provider).toBe("whatsapp");
    expect(result.providerMessageId).toBe("wamid.ABC");
    expect(result.providerAccountId).toBe("1107720082434785");
    expect(mockGetChannel).toHaveBeenCalledWith("WA_CHANNEL_1", "t1");
  });

  it("WhatsApp adapter rejects Instagram channel", async () => {
    mockGetChannel.mockResolvedValue({
      id: "IG_CHANNEL_1",
      tenantId: "t1",
      provider: "instagram",
      status: "active",
      externalAccountId: "349476715907213",
      accessTokenEncrypted: "IG_TOKEN",
    });

    const adapter = new WhatsAppOutboundAdapter();
    await expect(
      adapter.send({
        tenantId: "t1",
        userId: "u1",
        messageId: "m1",
        channelConnectionId: "IG_CHANNEL_1",
        provider: "whatsapp",
        contactPhone: "123",
        type: "text",
        payload: { type: "text" },
        metadata: null,
      } as any),
    ).rejects.toThrow("not a WhatsApp channel");
  });

  it("Instagram adapter resolves exact channel by channelConnectionId", async () => {
    mockGetChannel.mockResolvedValue({
      id: "IG_CHANNEL_1",
      tenantId: "t1",
      provider: "instagram",
      status: "active",
      externalAccountId: "349476715907213",
      accessTokenEncrypted: "IG_TOKEN",
    });

    const fakeFetch = jest.fn<(url: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ message_id: "ig-123" }),
    } as unknown as Response);
    (global as any).fetch = fakeFetch;

    const adapter = new InstagramOutboundAdapter();
    const result = await adapter.send({
      tenantId: "t1",
      userId: "u1",
      messageId: "m1",
      channelConnectionId: "IG_CHANNEL_1",
      provider: "instagram",
      contactPhone: "1086930670737976",
      providerRecipientId: "1086930670737976",
      type: "text",
      payload: { type: "text", text: { body: "Hello" } },
      metadata: null,
    } as any);

    expect(result.provider).toBe("instagram");
    expect(result.providerMessageId).toBe("ig-123");
    expect(result.providerAccountId).toBe("349476715907213");
  });
});
