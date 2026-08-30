import type { InstagramChannelConfig } from "@/lib/omnichannel-next/providers/instagram/instagram.types";

export interface InstagramChannelConfigPort {
  resolve(tenantId: string, channelConnectionId: string): Promise<InstagramChannelConfig>;
}
