import crypto from "crypto";
import { RealMySqlExecutor } from "./real-mysql-executor";
import {
  NoNetworkCaptureHttpClient,
  SingleShotMetaHttpClient,
  WhatsAppRealDryRun,
} from "@/lib/omnichannel-next/infrastructure/validation";
import type { DryRunEnvironment, SafeDryRunResult } from "@/lib/omnichannel-next/infrastructure/validation";
import { MySQLWhatsAppChannelConfigReadRepository } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";

type SmokeHttpResult = {
  status: number;
  metaAccepted: boolean;
  providerMessageIdPresent: boolean;
  metaErrorCode?: number;
  metaErrorMessage?: string;
};

type SmokeResult = SafeDryRunResult & {
  correlationId: string;
  armed: boolean;
  controlledRecipient: string;
  recipientMasked: string;
  metaHttp: SmokeHttpResult | null;
  metaAccepted: boolean;
  deliveryConfirmation: "PENDING_MANUAL_CONFIRMATION" | "CONFIRMED" | "NOT_APPLICABLE";
};

function deriveMetaKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function classifyEnvironment(): DryRunEnvironment {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") return "PRODUCTION";
  if (nodeEnv === "staging") return "STAGING";
  if (nodeEnv === "test") return "TEST";
  if (nodeEnv === "development" || nodeEnv === "dev" || (process.env.DB_HOST ?? "") === "localhost") return "LOCAL";
  if (nodeEnv === "local") return "LOCAL";
  return "UNKNOWN";
}

function parseArgs(): { tenantId?: string; channelConnectionId?: string; recipient?: string; executeRealSend: boolean } {
  const args = process.argv.slice(2);
  const result: { tenantId?: string; channelConnectionId?: string; recipient?: string; executeRealSend: boolean } = {
    executeRealSend: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant" && args[i + 1]) result.tenantId = args[i + 1];
    if (args[i] === "--channel" && args[i + 1]) result.channelConnectionId = args[i + 1];
    if (args[i] === "--recipient" && args[i + 1]) result.recipient = args[i + 1];
    if (args[i] === "--execute-real-send") result.executeRealSend = true;
  }

  if (!result.tenantId && args[0]) result.tenantId = args[0];
  if (!result.channelConnectionId && args[1]) result.channelConnectionId = args[1];

  return result;
}

function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) return "[MASKED]";
  return `${recipient.slice(0, -4).replace(/./g, "*")}${recipient.slice(-4)}`;
}

function validateRecipient(recipient?: string): string | null {
  if (!recipient) return null;
  const digits = recipient.replace(/\+/g, "").replace(/\D/g, "");
  if (/^\d{10,15}$/.test(digits)) return digits;
  return null;
}

function blockedResult(
  environment: DryRunEnvironment,
  reason: string,
  extra?: Partial<SmokeResult>,
): SmokeResult {
  const base: SmokeResult = {
    environment,
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
    correlationId: crypto.randomUUID(),
    armed: false,
    controlledRecipient: "[NONE]",
    recipientMasked: "[NONE]",
    metaHttp: null,
    metaAccepted: false,
    deliveryConfirmation: "NOT_APPLICABLE",
    blockedReason: reason,
  };
  return { ...base, ...extra };
}

async function main() {
  const correlationId = `STEP11_SMOKE_${crypto.randomUUID()}`;
  const environment = classifyEnvironment();

  if (environment === "UNKNOWN") {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_ENVIRONMENT_UNRESOLVED", { correlationId }), null, 2));
    process.exit(0);
  }

  const { tenantId, channelConnectionId, recipient, executeRealSend } = parseArgs();

  if (!tenantId || !channelConnectionId) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_TARGET_NOT_SPECIFIED", { correlationId }), null, 2));
    process.exit(0);
  }

  const metaKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  if (!metaKey || metaKey.trim().length === 0) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_MASTER_KEY_NOT_AVAILABLE", { correlationId }), null, 2));
    process.exit(0);
  }

  if (!executeRealSend) {
    console.log(JSON.stringify(blockedResult(environment, "ARMED_DRY_RUN_ONLY", { correlationId }), null, 2));
    process.exit(0);
  }

  const validRecipient = validateRecipient(recipient);
  if (!validRecipient) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_CONTROLLED_RECIPIENT_REQUIRED", { correlationId }), null, 2));
    process.exit(0);
  }

  const host = process.env.DB_HOST;
  const portRaw = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !portRaw || !user || !password || !database) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_NO_REAL_DB", { correlationId }), null, 2));
    process.exit(0);
  }

  let sql: RealMySqlExecutor | undefined;
  try {
    sql = new RealMySqlExecutor({
      host,
      port: Number(portRaw),
      user,
      password,
      database,
    });

    const key = deriveMetaKey(metaKey);
    const runner = new WhatsAppRealDryRun();
    const configRepo = new MySQLWhatsAppChannelConfigReadRepository(sql);
    const config = await configRepo.resolve(tenantId, channelConnectionId);
    const graphApiVersion = process.env.META_GRAPH_VERSION?.replace(/^v/i, "") ?? "25.0";

    // First run a dry-run to resolve channel and credential without network.
    const dryRun = await runner.run({
      environment,
      tenantId,
      channelConnectionId,
      sql,
      key,
      graphApiVersion,
      recipient: validRecipient,
      messageText: "BLIV CRM — teste técnico controlado do novo transporte WhatsApp.",
      http: new NoNetworkCaptureHttpClient(),
    });

    if (!dryRun.whatsappRequestBuilt) {
      console.log(JSON.stringify(
        blockedResult(environment, dryRun.blockedReason ?? "DRY_RUN_PRECHECK_FAILED", { ...dryRun, correlationId, armed: true, controlledRecipient: validRecipient, recipientMasked: maskRecipient(validRecipient) }),
        null,
        2,
      ));
      process.exit(0);
    }

    // Armed: one-shot real HTTPS to Meta.
    const realHttp = new SingleShotMetaHttpClient(
      config.phoneNumberId,
      `v${graphApiVersion}`,
      validRecipient,
    );

    const realRun = await runner.run({
      environment,
      tenantId,
      channelConnectionId,
      sql,
      key,
      graphApiVersion,
      recipient: validRecipient,
      messageText: "BLIV CRM — teste técnico controlado do novo transporte WhatsApp.",
      http: realHttp,
    });

    const metaResult = realHttp.result();

    const smoke: SmokeResult = {
      ...realRun,
      correlationId,
      armed: true,
      controlledRecipient: validRecipient,
      recipientMasked: maskRecipient(validRecipient),
      metaHttp: metaResult
        ? {
            status: metaResult.status,
            metaAccepted: metaResult.metaAccepted,
            providerMessageIdPresent: !!metaResult.providerMessageId,
            metaErrorCode: metaResult.metaErrorCode,
            metaErrorMessage: metaResult.metaErrorMessage,
          }
        : null,
      metaAccepted: metaResult?.metaAccepted ?? false,
      deliveryConfirmation: metaResult?.metaAccepted ? "PENDING_MANUAL_CONFIRMATION" : "NOT_APPLICABLE",
    };

    console.log(JSON.stringify(smoke, null, 2));
  } catch {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_NO_REAL_DB", { correlationId }), null, 2));
  } finally {
    await sql?.close();
  }
}

main().then(() => process.exit(0));
