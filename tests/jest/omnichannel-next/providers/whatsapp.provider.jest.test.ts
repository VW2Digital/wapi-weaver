import { describe, expect, test } from "@jest/globals";
import { WhatsAppProvider } from "@/lib/omnichannel-next/providers/whatsapp";
import type {
  WhatsAppChannelConfig,
  WhatsAppChannelConfigPort,
  WhatsAppTransportPort,
  WhatsAppTransportRequest,
} from "@/lib/omnichannel-next/providers/whatsapp";
import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { ProviderSendContext } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";

class FakeConfigPort implements WhatsAppChannelConfigPort {
  async resolve(): Promise<WhatsAppChannelConfig> {
    return {
      channelConnectionId: "wa-channel-1",
      senderIdentifier: "wa-sender",
      credentialReference: "wa-cred-ref",
    };
  }
}

class FakeTransportPort implements WhatsAppTransportPort {
  calls: WhatsAppTransportRequest[] = [];
  shouldThrow = false;

  async send(request: WhatsAppTransportRequest) {
    this.calls.push(request);
    if (this.shouldThrow) throw new Error("WhatsApp transport failed");
    return { providerMessageId: "wa-next-1" };
  }
}

const textContext: ProviderSendContext = {
  tenantId: "t1",
  conversationId: "conv-1",
  channelConnectionId: "wa-channel-1",
  messageId: "msg-1",
  provider: "whatsapp",
  recipient: "wa-contact-1",
  message: { type: "text", text: "hello" },
};

describe("WhatsAppProvider", () => {
  test("sends text and normalizes result", async () => {
    const transport = new FakeTransportPort();
    const provider = new WhatsAppProvider(new FakeConfigPort(), transport);

    const result = await provider.send(textContext);

    expect(result.providerMessageId).toBe("wa-next-1");
    expect(result.status).toBe("sent");
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0].credentialReference).toBe("wa-cred-ref");
    expect(transport.calls[0].sender).toBe("wa-sender");
    expect(transport.calls[0].recipient).toBe("wa-contact-1");
    expect(transport.calls[0].message.type).toBe("text");
    expect(transport.calls[0].message.text).toBe("hello");
  });

  test("rejects unsupported image media", async () => {
    const provider = new WhatsAppProvider(new FakeConfigPort(), new FakeTransportPort());
    const context = { ...textContext, message: { type: "image" as const, media: { reference: "img" } } };

    await expect(provider.send(context)).rejects.toThrow(OmnichannelError);
  });

  test("rejects provider mismatch", async () => {
    const provider = new WhatsAppProvider(new FakeConfigPort(), new FakeTransportPort());
    const context = { ...textContext, provider: "instagram" as const };

    await expect(provider.send(context)).rejects.toThrow(OmnichannelError);
  });

  test("surfaces transport failure", async () => {
    const transport = new FakeTransportPort();
    transport.shouldThrow = true;
    const provider = new WhatsAppProvider(new FakeConfigPort(), transport);

    await expect(provider.send(textContext)).rejects.toThrow("WhatsApp transport failed");
  });
});
