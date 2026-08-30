import crypto from "crypto";
import { RealMySqlExecutor } from "./real-mysql-executor";
import { WhatsAppRealDryRun } from "@/lib/omnichannel-next/infrastructure/validation";
import type { DryRunEnvironment, SafeDryRunResult } from "@/lib/omnichannel-next/infrastructure/validation";

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

function parseArgs(): { tenantId?: string; channelConnectionId?: string } {
  const args = process.argv.slice(2);
  let tenantId: string | undefined;
  let channelConnectionId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant" && args[i + 1]) tenantId = args[i + 1];
    if (args[i] === "--channel" && args[i + 1]) channelConnectionId = args[i + 1];
  }

  if (!tenantId && args[0]) tenantId = args[0];
  if (!channelConnectionId && args[1]) channelConnectionId = args[1];

  return { tenantId, channelConnectionId };
}

function blockedResult(
  environment: DryRunEnvironment,
  reason: string,
): SafeDryRunResult {
  return {
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
    blockedReason: reason,
  };
}

async function main() {
  const environment = classifyEnvironment();
  if (environment === "UNKNOWN") {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_ENVIRONMENT_UNRESOLVED"), null, 2));
    process.exit(0);
  }

  const { tenantId, channelConnectionId } = parseArgs();
  if (!tenantId || !channelConnectionId) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_TARGET_NOT_SPECIFIED"), null, 2));
    process.exit(0);
  }

  const metaKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  if (!metaKey || metaKey.trim().length === 0) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_MASTER_KEY_NOT_AVAILABLE"), null, 2));
    process.exit(0);
  }

  const host = process.env.DB_HOST;
  const portRaw = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !portRaw || !user || !password || !database) {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_NO_REAL_DB"), null, 2));
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
    const result = await runner.run({
      environment,
      tenantId,
      channelConnectionId,
      sql,
      key,
    });

    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.log(JSON.stringify(blockedResult(environment, "BLOCKED_NO_REAL_DB"), null, 2));
  } finally {
    await sql?.close();
  }
}

main().then(() => process.exit(0));
