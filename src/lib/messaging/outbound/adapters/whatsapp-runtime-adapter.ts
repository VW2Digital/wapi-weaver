import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { getWhatsAppOutboundRuntime, getWhatsAppNextAdapter } from "../runtime-config";
import { WhatsAppOutboundAdapter } from "./whatsapp.outbound-adapter";
import { UnsupportedProviderError } from "../types";

export class WhatsAppRuntimeAdapter implements IOutboundAdapter {
  readonly provider = "whatsapp" as const;
  private readonly current = new WhatsAppOutboundAdapter();

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    const runtime = getWhatsAppOutboundRuntime();
    if (runtime === "next") {
      return getWhatsAppNextAdapter().send(context);
    }
    return this.current.send(context);
  }
}
