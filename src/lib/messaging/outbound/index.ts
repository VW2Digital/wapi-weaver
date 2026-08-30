import { providerRegistry } from "./provider-registry";
import { WhatsAppOutboundAdapter } from "./adapters/whatsapp.outbound-adapter";
import { InstagramOutboundAdapter } from "./adapters/instagram.outbound-adapter";
import { MessengerOutboundAdapter } from "./adapters/messenger.outbound-adapter";

providerRegistry.register(new WhatsAppOutboundAdapter());
providerRegistry.register(new InstagramOutboundAdapter());
providerRegistry.register(new MessengerOutboundAdapter());

export * from "./types";
export { providerRegistry } from "./provider-registry";
export { providerDispatcher } from "./provider-dispatcher";
