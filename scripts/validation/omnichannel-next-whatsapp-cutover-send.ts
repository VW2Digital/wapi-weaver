import process from "node:process";
import { randomUUID } from "node:crypto";
import { registerWhatsAppNextAdapter } from "@/lib/omnichannel-next/bridges/register-whatsapp-next";
import {
  enqueueChatOutboxMessage,
  processChatOutboxBatch,
} from "@/lib/chat-outbox.server.ts";
import { RealMySqlExecutor } from "@/lib/messaging/bridges/real-mysql-executor";

const TENANT_ID = "6da65e93-4864-43c5-b17b-4c3864a49cfc";
const CHANNEL_CONNECTION_ID = "f4c277a7-3e71-408f-abc7-c4938e7a8727";
const CONTACT_PHONE = "5591985646076";
const TEXT = "BLIV CRM — validação pós-cutover do WhatsApp Next.";

async function main() {
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

  const [session] = await sql.execute<{ id: string; contact_id: string }>(
    `SELECT id, contact_id FROM chat_sessions WHERE tenant_id = ? AND channel_connection_id = ? AND contact_id IN (
      SELECT id FROM contacts WHERE phone_e164 = ?
    )`,
    [TENANT_ID, CHANNEL_CONNECTION_ID, CONTACT_PHONE],
  );

  if (!session) {
    throw new Error(`No controlled conversation for tenant ${TENANT_ID}, channel ${CHANNEL_CONNECTION_ID}, phone ${CONTACT_PHONE}`);
  }

  const [firstUser] = await sql.execute<{ id: string }>(`SELECT id FROM users LIMIT 1`, []);
  if (!firstUser) {
    throw new Error("No user found");
  }

  const clientMessageId = randomUUID();
  const conversationId = session.id;
  const userId = firstUser.id;

  const queued = await enqueueChatOutboxMessage({
    clientMessageId,
    tenantId: TENANT_ID,
    userId,
    conversationId,
    contactPhone: CONTACT_PHONE,
    channel: "whatsapp",
    channelConnectionId: CHANNEL_CONNECTION_ID,
    providerRecipientId: CONTACT_PHONE,
    providerAccountId: null,
    type: "text",
    body: TEXT,
    payload: { type: "text", text: { body: TEXT } },
    metadata: null,
    replyToMessageId: null,
  });

  const processedCount = await processChatOutboxBatch();

  const outboxRows = await sql.execute<{
    id: string;
    status: string;
    provider_message_id: string | null;
    payload: string;
  }>(
    `SELECT id, status, provider_message_id, payload FROM chat_message_outbox
     WHERE conversation_id = ? ORDER BY created_at DESC`,
    [conversationId],
  );

  const directRows = await sql.execute<{
    id: string;
    status: string;
    wa_message_id: string | null;
    provider_message_id: string | null;
  }>(
    `SELECT id, status, wa_message_id, provider_message_id FROM direct_messages
     WHERE client_message_id = ?`,
    [clientMessageId],
  );

  await sql.close();

  const providerMessageId = directRows[0]?.wa_message_id ?? directRows[0]?.provider_message_id ?? null;
  const safeProviderMessageId = providerMessageId ? `${providerMessageId.slice(0, 4)}...${providerMessageId.slice(-4)}` : null;

  process.stdout.write(
    JSON.stringify(
      {
        status: "CUTOVER_SEND_ATTEMPTED",
        queued,
        processedCount,
        conversationId,
        clientMessageId,
        directMessagesCount: directRows.length,
        directMessageStatus: directRows[0]?.status ?? null,
        chatMessageOutboxCount: outboxRows.length,
        providerMessageId: safeProviderMessageId,
      },
      null,
      2,
    ) + "\n",
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
