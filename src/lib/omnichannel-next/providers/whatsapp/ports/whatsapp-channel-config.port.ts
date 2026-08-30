import type { WhatsAppChannelConfig } from "@/lib/omnichannel-next/providers/whatsapp/whatsapp.types";

export interface WhatsAppChannelConfigPort {
  resolve(tenantId: string, channelConnectionId: string): Promise<WhatsAppChannelConfig>;
}
