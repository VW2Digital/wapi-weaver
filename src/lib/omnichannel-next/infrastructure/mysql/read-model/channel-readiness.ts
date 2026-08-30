import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import { MySQLWhatsAppChannelConfigReadRepository } from "./whatsapp-channel-config-read.repository";
import { MySQLInstagramChannelConfigReadRepository } from "./instagram-channel-config-read.repository";
import { MySQLCredentialRecordReadRepository } from "./credential-record-read.repository";
import type { SqlExecutor } from "../mysql.types";
import type { ChannelReadiness } from "./read-model.types";

export function createWhatsAppReadinessResolver(sql: SqlExecutor) {
  const configRepo = new MySQLWhatsAppChannelConfigReadRepository(sql);
  const credentialRepo = new MySQLCredentialRecordReadRepository(sql);

  return async (tenantId: string, channelConnectionId: string): Promise<ChannelReadiness> => {
    const blockers: string[] = [];

    try {
      const config = await configRepo.resolve(tenantId, channelConnectionId);
      const record = await credentialRepo.findByReference(config.credentialReference);

      if (!record.exists) {
        blockers.push("CREDENTIAL_RECORD_NOT_FOUND");
      } else if (!record.ciphertextPresent) {
        blockers.push("CREDENTIAL_CIPHERTEXT_MISSING");
      }

      return {
        channelConnectionId,
        provider: "whatsapp",
        configResolvable: true,
        credentialReferenceResolvable: record.exists && record.ciphertextPresent,
        blockers,
      };
    } catch (error: any) {
      if (error instanceof OmnichannelError) {
        blockers.push(error.code);
      } else {
        blockers.push("UNKNOWN_ERROR");
      }

      return {
        channelConnectionId,
        provider: "whatsapp",
        configResolvable: false,
        credentialReferenceResolvable: false,
        blockers,
      };
    }
  };
}

export function createInstagramReadinessResolver(sql: SqlExecutor) {
  const configRepo = new MySQLInstagramChannelConfigReadRepository(sql);
  const credentialRepo = new MySQLCredentialRecordReadRepository(sql);

  return async (tenantId: string, channelConnectionId: string): Promise<ChannelReadiness> => {
    const blockers: string[] = ["INSTAGRAM_API_VARIANT_REQUIRED"];

    try {
      const config = await configRepo.resolve(tenantId, channelConnectionId);

      if (!config.instagramUserId && !config.pageId) {
        blockers.push("INSTAGRAM_IDENTITY_UNRESOLVED");
      }

      if (config.credentialReference) {
        const record = await credentialRepo.findByReference(config.credentialReference);
        if (!record.exists || !record.ciphertextPresent) {
          blockers.push("CREDENTIAL_NOT_RESOLVABLE");
        }
      } else {
        blockers.push("CREDENTIAL_NOT_RESOLVABLE");
      }

      return {
        channelConnectionId,
        provider: "instagram",
        configResolvable: true,
        credentialReferenceResolvable: !blockers.includes("CREDENTIAL_NOT_RESOLVABLE"),
        blockers,
      };
    } catch (error: any) {
      if (error instanceof OmnichannelError) {
        blockers.push(error.code);
      } else {
        blockers.push("UNKNOWN_ERROR");
      }

      return {
        channelConnectionId,
        provider: "instagram",
        configResolvable: false,
        credentialReferenceResolvable: false,
        blockers,
      };
    }
  };
}
