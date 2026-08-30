import type { MessagingProvider } from "../types";
import type { IOutboundAdapter } from "./types";
import { UnsupportedProviderError } from "./types";

export class ProviderRegistry {
  private readonly adapters = new Map<MessagingProvider, IOutboundAdapter>();

  register(adapter: IOutboundAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: MessagingProvider): IOutboundAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new UnsupportedProviderError(provider);
    }
    return adapter;
  }

  has(provider: MessagingProvider): boolean {
    return this.adapters.has(provider);
  }

  list(): MessagingProvider[] {
    return Array.from(this.adapters.keys());
  }
}

export const providerRegistry = new ProviderRegistry();
