import process from "node:process";
import { randomUUID } from "node:crypto";
import { registerWhatsAppNextAdapter } from "@/lib/omnichannel-next/bridges/register-whatsapp-next";
import { providerDispatcher } from "@/lib/messaging/outbound/provider-dispatcher";
import { RealMySqlExecutor } from "@/lib/messaging/bridges/real-mysql-executor";

interface Args {
  tenant: string;
  channel: string;
  conversation?: string;
  recipient: string;
  text: string;
}

function parseArgs(argv: string[]): Args {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key && value) {
      args[key] = value;
    }
  }

  const tenant = args["--tenant"];
  const channel = args["--channel"];
  const recipient = args["--recipient"];
  const text = args["--text"] ?? "BLIV CRM — validação pós-cutover do WhatsApp Next.";

  if (!tenant || !channel || !recipient) {
    throw new Error("Usage: --tenant <uuid> --channel <uuid> --recipient <phone> [--conversation <uuid>] [--text <string>]");
  }

  return { tenant, channel, conversation: args["--conversation"], recipient, text };
}

async function findConversation(sql: RealMySqlExecutor, tenantId: string, channelConnectionId: string): Promise<string | null> {
  const rows = await sql.execute<{ id: string }>(
    `SELECT id FROM chat_sessions WHERE tenant_id = ? AND channel_connection_id = ? ORDER BY created_at DESC LIMIT 1`,
    [tenantId, channelConnectionId],
  );
  return rows[0]?.id ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  process.env.WHATSAPP_OUTBOUND_RUNTIME = "next";
  registerWhatsAppNextAdapter();

  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error("Database not configured");
  }

  const sql = new RealMySqlExecutor({ host, port, user, password, database });

  let conversationId = args.conversation;
  if (!conversationId) {
    conversationId = await findConversation(sql, args.tenant, args.channel);
    if (!conversationId) {
      throw new Error(`No conversation found for tenant ${args.tenant} and channel ${args.channel}. Provide --conversation.`);
    }
  }

  const result = await providerDispatcher.dispatch({
    tenantId: args.tenant,
    userId: args.tenant,
    messageId: randomUUID(),
    conversationId,
    channelConnectionId: args.channel,
    provider: "whatsapp",
    contactPhone: args.recipient,
    providerRecipientId: args.recipient,
    providerAccountId: null,
    type: "text",
    payload: { type: "text", text: { body: args.text } },
    metadata: null,
  });

  await sql.close();

  const providerMessageId = result.providerMessageId;
  const safeMessageId = providerMessageId ? `${providerMessageId.slice(0, 4)}...${providerMessageId.slice(-4)}` : null;

  process.stdout.write(
    JSON.stringify(
      {
        status: "CUTOVER_SEND_ATTEMPTED",
        provider: result.provider,
        providerMessageIdPresent: !!providerMessageId,
        providerMessageId: safeMessageId,
        accepted: result.status === "accepted",
        responsePayload: result.responsePayload,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
