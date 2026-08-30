import type { SqlExecutor } from "../mysql.types";
import { MySQLWhatsAppChannelConfigReadRepository } from "./whatsapp-channel-config-read.repository";
import type { WhatsAppChannelConfig } from "@/lib/omnichannel-next/providers/whatsapp/whatsapp.types";
import type { WhatsAppChannelConfigPort } from "@/lib/omnichannel-next/providers/whatsapp/ports/whatsapp-channel-config.port";

export class MySQLWhatsAppChannelConfigAdapter implements WhatsAppChannelConfigPort {
  private readonly repository: MySQLWhatsAppChannelConfigReadRepository;

  constructor(sql: SqlExecutor) {
    this.repository = new MySQLWhatsAppChannelConfigReadRepository(sql);
  }

  async resolve(tenantId: string, channelConnectionId: string): Promise<WhatsAppChannelConfig> {
    const resolved = await this.repository.resolve(tenantId, channelConnectionId);
    return {
      channelConnectionId: resolved.channelConnectionId,
      senderIdentifier: resolved.phoneNumberId,
      credentialReference: JSON.stringify(resolved.credentialReference),
    };
  }
}
