import type { Channel } from "@/lib/omnichannel-next/domain/channel";

export interface ChannelPort {
  getById(tenantId: string, channelConnectionId: string): Promise<Channel | null>;
}
