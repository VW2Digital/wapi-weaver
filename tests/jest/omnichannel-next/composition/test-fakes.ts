import type { WhatsAppTransportPort } from "@/lib/omnichannel-next/providers/whatsapp";
import type { InstagramTransportPort } from "@/lib/omnichannel-next/providers/instagram";
import type { WhatsAppTransportRequest, WhatsAppTransportResult } from "@/lib/omnichannel-next/providers/whatsapp/whatsapp.types";
import type { InstagramTransportRequest, InstagramTransportResult } from "@/lib/omnichannel-next/providers/instagram/instagram.types";

export class FakeWhatsAppTransport implements WhatsAppTransportPort {
  calls: WhatsAppTransportRequest[] = [];
  shouldThrow = false;

  async send(request: WhatsAppTransportRequest): Promise<WhatsAppTransportResult> {
    if (this.shouldThrow) throw new Error("WhatsApp transport failed");
    this.calls.push(request);
    return { providerMessageId: "wa-msg-123" };
  }
}

export class FakeInstagramTransport implements InstagramTransportPort {
  calls: InstagramTransportRequest[] = [];
  shouldThrow = false;

  async send(request: InstagramTransportRequest): Promise<InstagramTransportResult> {
    if (this.shouldThrow) throw new Error("Instagram transport failed");
    this.calls.push(request);
    return { providerMessageId: "ig-msg-123" };
  }
}
