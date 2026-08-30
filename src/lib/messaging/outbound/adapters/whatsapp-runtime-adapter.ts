import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { getWhatsAppOutboundRuntime } from "../runtime-config";
import { WhatsAppOutboundAdapter } from "./whatsapp.outbound-adapter";
import { WhatsAppNextOutboundAdapter } from "./whatsapp-next-adapter";
import { UnsupportedProviderError } from "../types";

export class WhatsAppRuntimeAdapter implements IOutboundAdapter {
  readonly provider = "whatsapp" as const;
  private readonly current = new WhatsAppOutboundAdapter();
  private readonly next = new WhatsAppNextOutboundAdapter();

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    const runtime = getWhatsAppOutboundRuntime();
    if (runtime === "next") {
      return this.next.send(context);
    }
    return this.current.send(context);
  }
}
