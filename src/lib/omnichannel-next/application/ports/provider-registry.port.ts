import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundProviderPort } from "./outbound-provider.port";

export interface ProviderRegistryPort {
  get(provider: Provider): OutboundProviderPort;
}
