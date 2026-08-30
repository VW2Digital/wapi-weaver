import { describe, expect, test } from "@jest/globals";
import { InstagramProvider } from "@/lib/omnichannel-next/providers/instagram";
import type {
  InstagramChannelConfig,
  InstagramChannelConfigPort,
  InstagramTransportPort,
  InstagramTransportRequest,
} from "@/lib/omnichannel-next/providers/instagram";
import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { ProviderSendContext } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";

class FakeConfigPort implements InstagramChannelConfigPort {
  async resolve(): Promise<InstagramChannelConfig> {
    return {
      channelConnectionId: "ig-channel-1",
      senderIdentifier: "ig-sender",
      credentialReference: "ig-cred-ref",
    };
  }
}

class FakeTransportPort implements InstagramTransportPort {
  calls: InstagramTransportRequest[] = [];
  shouldThrow = false;

  async send(request: InstagramTransportRequest) {
    this.calls.push(request);
    if (this.shouldThrow) throw new Error("Instagram transport failed");
    return { providerMessageId: "ig-next-1" };
  }
}

const textContext: ProviderSendContext = {
  tenantId: "t1",
  conversationId: "conv-1",
  channelConnectionId: "ig-channel-1",
  messageId: "msg-1",
  provider: "instagram",
  recipient: "ig-contact-1",
  message: { type: "text", text: "hello" },
};

describe("InstagramProvider", () => {
  test("sends text and normalizes result", async () => {
    const transport = new FakeTransportPort();
    const provider = new InstagramProvider(new FakeConfigPort(), transport);

    const result = await provider.send(textContext);

    expect(result.providerMessageId).toBe("ig-next-1");
    expect(result.status).toBe("sent");
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].credentialReference).toBe("ig-cred-ref");
    expect(transport.calls[0].sender).toBe("ig-sender");
    expect(transport.calls[0].recipient).toBe("ig-contact-1");
    expect(transport.calls[0].message.type).toBe("text");
    expect(transport.calls[0].message.text).toBe("hello");
  });

  test("rejects unsupported document media", async () => {
    const provider = new InstagramProvider(new FakeConfigPort(), new FakeTransportPort());
    const context = { ...textContext, message: { type: "document" as const, media: { reference: "doc" } } };

    await expect(provider.send(context)).rejects.toThrow(OmnichannelError);
  });

  test("rejects provider mismatch", async () => {
    const provider = new InstagramProvider(new FakeConfigPort(), new FakeTransportPort());
    const context = { ...textContext, provider: "whatsapp" as const };

    await expect(provider.send(context)).rejects.toThrow(OmnichannelError);
  });

  test("surfaces transport failure", async () => {
    const transport = new FakeTransportPort();
    transport.shouldThrow = true;
    const provider = new InstagramProvider(new FakeConfigPort(), transport);

    await expect(provider.send(textContext)).rejects.toThrow("Instagram transport failed");
  });
});
