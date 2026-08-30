import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import { MetaWhatsAppTransport } from "@/lib/omnichannel-next/infrastructure/meta/whatsapp";
import { MySQLWhatsAppChannelConfigReadRepository } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import {
  AesGcmCredentialDecryptor,
  LiteralEncryptionKeyProvider,
  MySQLEncryptedCredentialRepository,
  SecureCredentialVault,
  WhatsAppCredentialResolver,
} from "@/lib/omnichannel-next/infrastructure/security";
import type { SqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql";
import { NoNetworkCaptureHttpClient } from "./no-network-capture-http-client";
import type { CapturedHttpDescriptor } from "./no-network-capture-http-client";
import { SingleShotMetaHttpClient } from "./single-shot-meta-http-client";

export type DryRunEnvironment = "LOCAL" | "TEST" | "STAGING" | "PRODUCTION" | "UNKNOWN";

export interface WhatsAppRealDryRunOptions {
  tenantId: string;
  channelConnectionId: string;
  environment: DryRunEnvironment;
  sql: SqlExecutor;
  key: Buffer;
  graphApiVersion?: string;
  recipient?: string;
  messageText?: string;
  http?: NoNetworkCaptureHttpClient | SingleShotMetaHttpClient;
}

export interface SafeDryRunResult {
  environment: DryRunEnvironment;
  realChannelResolved: boolean;
  realPhoneNumberIdResolved: boolean;
  realCredentialReferenceResolved: boolean;
  realEncryptedCredentialFound: boolean;
  realDecryption: "PASS" | "FAIL" | "BLOCKED";
  realCredentialExposed: boolean;
  whatsappRequestBuilt: boolean;
  networkAttempts: number;
  metaRequestsSent: number;
  realMessagesSent: number;
  captured: CapturedHttpDescriptor | null;
  blockedReason?: string;
}

export class WhatsAppRealDryRun {
  async run(options: WhatsAppRealDryRunOptions): Promise<SafeDryRunResult> {
    const baseResult: SafeDryRunResult = {
      environment: options.environment,
      realChannelResolved: false,
      realPhoneNumberIdResolved: false,
      realCredentialReferenceResolved: false,
      realEncryptedCredentialFound: false,
      realDecryption: "BLOCKED",
      realCredentialExposed: false,
      whatsappRequestBuilt: false,
      networkAttempts: 0,
      metaRequestsSent: 0,
      realMessagesSent: 0,
      captured: null,
    };

    if (options.environment === "UNKNOWN") {
      return { ...baseResult, blockedReason: "BLOCKED_ENVIRONMENT_UNRESOLVED" };
    }

    const http = options.http ?? new NoNetworkCaptureHttpClient();

    try {
      const configRepo = new MySQLWhatsAppChannelConfigReadRepository(options.sql);
      const config = await configRepo.resolve(options.tenantId, options.channelConnectionId);

      baseResult.realChannelResolved = true;
      baseResult.realPhoneNumberIdResolved = true;
      baseResult.realCredentialReferenceResolved = true;

      const encryptedRepo = new MySQLEncryptedCredentialRepository(options.sql);
      const keyProvider = new LiteralEncryptionKeyProvider(options.key);
      const vault = new SecureCredentialVault(encryptedRepo, new AesGcmCredentialDecryptor(keyProvider));
      const credentialResolver = new WhatsAppCredentialResolver(vault);

      const graphApiVersion = options.graphApiVersion?.replace(/^v/i, "") ?? "25.0";
      const transport = new MetaWhatsAppTransport({ graphApiVersion }, http, credentialResolver);

      const recipient = options.recipient ?? "15555551234";
      const messageText = options.messageText ?? "OMNICHANNEL_NEXT_DRY_RUN";

      await transport.send({
        recipient,
        sender: config.phoneNumberId,
        credentialReference: JSON.stringify(config.credentialReference),
        message: { type: "text", text: messageText },
      });

      baseResult.realEncryptedCredentialFound = true;
      baseResult.realDecryption = "PASS";
      baseResult.whatsappRequestBuilt = true;
      baseResult.networkAttempts = http.networkAttempts;
      baseResult.metaRequestsSent = (http as { sentRequests?: number }).sentRequests ?? 0;
      baseResult.realMessagesSent = baseResult.metaRequestsSent;
      baseResult.captured = this.maskCaptured(http.captured());

      return baseResult;
    } catch (error) {
      if (error instanceof OmnichannelError) {
        if (error.code === "CREDENTIAL_DECRYPTION_ERROR" || error.code === "CREDENTIAL_FORMAT_ERROR") {
          baseResult.realDecryption = "FAIL";
        }
        return { ...baseResult, blockedReason: error.code };
      }
      return { ...baseResult, blockedReason: "DRY_RUN_UNEXPECTED_ERROR" };
    }
  }

  private maskCaptured(captured: CapturedHttpDescriptor | null): CapturedHttpDescriptor | null {
    if (!captured) return null;
    const masked = { ...captured };
    const version = captured.graphVersion;
    masked.senderNode = "[MASKED]";
    masked.path = `/v${version.replace(/^v/i, "")}/[MASKED]/messages`;
    masked.url = `https://[REDACTED_HOST]/v${version.replace(/^v/i, "")}/[MASKED]/messages`;
    return masked;
  }
}
