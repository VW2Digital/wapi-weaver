import { UnsupportedProviderError } from "@/lib/omnichannel-next/domain/errors";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundProviderPort } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type { ProviderRegistryPort } from "@/lib/omnichannel-next/application/ports/provider-registry.port";

export { WhatsAppProvider } from "./whatsapp";
export { InstagramProvider } from "./instagram";
export { WHATSAPP_CAPABILITIES } from "./whatsapp";
export { INSTAGRAM_CAPABILITIES } from "./instagram";
export type { WhatsAppChannelConfigPort } from "./whatsapp";
export type { InstagramChannelConfigPort } from "./instagram";

export class NextProviderRegistry implements ProviderRegistryPort {
  private adapters: Map<Provider, OutboundProviderPort> = new Map();

  register(port: OutboundProviderPort): void {
    this.adapters.set(port.provider, port);
  }

  get(provider: Provider): OutboundProviderPort {
    const port = this.adapters.get(provider);
    if (!port) throw new UnsupportedProviderError(provider);
    return port;
  }
}
