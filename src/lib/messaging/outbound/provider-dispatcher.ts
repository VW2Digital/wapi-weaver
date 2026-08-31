import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "./types";
import { providerRegistry } from "./provider-registry";
import { UnsupportedProviderError } from "./types";
import { WhatsAppRuntimeAdapter } from "./adapters/whatsapp-runtime-adapter";
import { InstagramOutboundAdapter } from "./adapters/instagram.outbound-adapter";
import { MessengerOutboundAdapter } from "./adapters/messenger.outbound-adapter";
import { WebChatOutboundAdapter } from "./adapters/webchat-outbound-adapter";

providerRegistry.register(new WhatsAppRuntimeAdapter());
providerRegistry.register(new InstagramOutboundAdapter());
providerRegistry.register(new MessengerOutboundAdapter());
providerRegistry.register(new WebChatOutboundAdapter());

export class ProviderDispatcher {
  constructor(private readonly registry: { get(provider: string): IOutboundAdapter }) {}

  async dispatch(context: OutboundMessageContext): Promise<OutboundSendResult> {
    const adapter = this.registry.get(context.provider);
    return adapter.send(context);
  }

  resolve(provider: string): IOutboundAdapter {
    if (!isMessagingProvider(provider)) {
      throw new UnsupportedProviderError(provider);
    }
    return this.registry.get(provider);
  }
}

function isMessagingProvider(value: string): value is "whatsapp" | "instagram" | "messenger" | "webchat" {
  return value === "whatsapp" || value === "instagram" || value === "messenger" || value === "webchat";
}

export const providerDispatcher = new ProviderDispatcher(providerRegistry);
