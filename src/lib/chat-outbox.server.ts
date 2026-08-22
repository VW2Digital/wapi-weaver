"use server";

import { randomUUID } from "node:crypto";
import db from "./db";
import { normalizeWaMessageId } from "./wa-message-id";
import { sendInstagramMessage } from "./instagram-messenger";
import { publishChatRealtimeEvent } from "./chat-realtime.server";

type ChatChannel = "whatsapp" | "instagram" | "messenger";

export interface ChatProviderPayload {
  type: string;
  text?: { body: string; preview_url?: boolean };
  reaction?: { message_id: string; emoji: string };
  image?: { id?: string; link?: string };
  audio?: { id?: string; link?: string; voice?: boolean };
  video?: { id?: string; link?: string };
  document?: { id?: string; link?: string; filename?: string };
  sticker?: { id?: string; link?: string };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: unknown[];
  reply_to_message_id?: string;
}

export interface EnqueueChatMessageInput {
  tenantId: string;
  userId: string;
  clientMessageId: string;
  contactPhone: string;
  channel: ChatChannel;
  providerRecipientId?: string | null;
  providerAccountId?: string | null;
  type: string;
  body: string;
  replyToMessageId?: string | null;
  metadata: unknown;
  payload: ChatProviderPayload;
}

interface ChatOutboxRow {
  id: string;
  tenant_id: string;
  user_id: string;
  message_id: string;
  channel: ChatChannel;
  recipient: string;
  provider_recipient_id?: string | null;
  provider_account_id?: string | null;
  payload: ChatProviderPayload | string;
  attempts: number;
  max_attempts: number;
}

interface DispatchResult {
  providerMessageId: string | null;
  providerAccountId: string | null;
  responsePayload: unknown;
}

interface MetaResponseBody {
  error?: {
    code?: number | string;
    message?: string;
    type?: string;
    error_subcode?: number | string;
    error_data?: { details?: string };
    fbtrace_id?: string;
  };
  message_id?: string;
  messages?: Array<{ id?: string }>;
  raw?: string;
}

type NetworkCause = NodeJS.ErrnoException & { hostname?: string };

class DispatchError extends Error {
  retryable: boolean;
  responsePayload: unknown;

  constructor(message: string, retryable: boolean, responsePayload?: unknown) {
    super(message);
    this.name = "DispatchError";
    this.retryable = retryable;
    this.responsePayload = responsePayload ?? null;
  }
}

function parsePayload(payload: ChatOutboxRow["payload"]): ChatProviderPayload {
  if (typeof payload !== "string") return payload;
  return JSON.parse(payload) as ChatProviderPayload;
}

function recentMetaVersion(rawVersion?: string | null): string {
  const version = rawVersion || "v26.0";
  if (!/^v\d+(?:\.\d+)?$/.test(version)) return "v26.0";
  const numeric = Number(version.slice(1));
  return numeric >= 24 && numeric <= 26 ? version : "v26.0";
}

function isRetryableMetaError(status: number, body: MetaResponseBody): boolean {
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  const code = Number(body?.error?.code);
  return [1, 2, 4, 17, 32, 341, 613].includes(code);
}

function errorMessage(body: MetaResponseBody, fallback: string): string {
  const message = body?.error?.message || fallback;
  const details = body?.error?.error_data?.details;
  const code = body?.error?.code;
  return [message, details, code != null ? `(code ${code})` : ""].filter(Boolean).join(" ");
}

function buildWhatsAppPayload(recipient: string, data: ChatProviderPayload) {
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: data.type,
  };

  if (data.reply_to_message_id) {
    payload.context = { message_id: data.reply_to_message_id };
  }

  if (data.type === "text") {
    payload.text = {
      body: data.text?.body || "",
      preview_url: data.text?.preview_url ?? false,
    };
  } else if (data.type === "reaction") {
    payload.reaction = data.reaction;
  } else if (data.type === "image") {
    payload.image = data.image?.id ? { id: data.image.id } : { link: data.image?.link };
  } else if (data.type === "audio") {
    payload.audio = data.audio?.id
      ? { id: data.audio.id, ...(data.audio.voice ? { voice: true } : {}) }
      : { link: data.audio?.link, ...(data.audio?.voice ? { voice: true } : {}) };
  } else if (data.type === "video") {
    payload.video = data.video?.id ? { id: data.video.id } : { link: data.video?.link };
  } else if (data.type === "document") {
    payload.document = data.document?.id
      ? { id: data.document.id, filename: data.document.filename }
      : { link: data.document?.link, filename: data.document?.filename };
  } else if (data.type === "sticker") {
    payload.sticker = data.sticker?.id ? { id: data.sticker.id } : { link: data.sticker?.link };
  } else if (data.type === "location") {
    payload.location = data.location;
  } else if (data.type === "contacts") {
    payload.contacts = data.contacts;
  }

  return payload;
}

function buildMessengerPayload(recipientId: string, data: ChatProviderPayload) {
  const payload: Record<string, unknown> = { recipient: { id: recipientId } };
  if (data.type === "text") {
    payload.message = { text: data.text?.body || "" };
  } else if (data.type === "reaction") {
    payload.sender_action = "react";
    payload.payload = data.reaction;
  } else if (["image", "audio", "video", "document"].includes(data.type)) {
    const media = data[data.type as "image" | "audio" | "video" | "document"];
    payload.message = {
      attachment: {
        type: data.type === "document" ? "file" : data.type,
        payload: media?.id ? { attachment_id: media.id } : { url: media?.link },
      },
    };
  }
  return payload;
}

async function parseResponse(response: Response): Promise<MetaResponseBody> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 4000) };
  }
}

function networkDispatchError(error: unknown): DispatchError {
  const cause = error instanceof Error ? (error.cause as NetworkCause | undefined) : null;
  const networkMessage = error instanceof Error ? error.message : "Falha de rede";
  const causeDetails = [cause?.code, cause?.syscall, cause?.hostname].filter(Boolean).join(" · ");
  const responsePayload = cause
    ? {
        code: cause.code ?? null,
        errno: cause.errno ?? null,
        syscall: cause.syscall ?? null,
        hostname: cause.hostname ?? null,
      }
    : null;

  console.error("[Chat Outbox] Falha de rede no provedor:", {
    message: networkMessage,
    ...responsePayload,
  });
  return new DispatchError(
    causeDetails
      ? `Falha de rede: ${networkMessage} (${causeDetails})`
      : `Falha de rede: ${networkMessage}.`,
    true,
    responsePayload,
  );
}

async function dispatchWhatsApp(job: ChatOutboxRow): Promise<DispatchResult> {
  const profiles = (await db.query(
    `SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version
     FROM profiles WHERE id = ? LIMIT 1`,
    [job.user_id],
  )) as Array<{
    whatsapp_phone_number_id?: string | null;
    whatsapp_access_token?: string | null;
    meta_graph_version?: string | null;
  }>;
  const profile = profiles[0];
  if (!profile?.whatsapp_phone_number_id || !profile.whatsapp_access_token) {
    throw new DispatchError("Credenciais do WhatsApp não configuradas.", false);
  }

  const payloadData = parsePayload(job.payload);
  const isVoiceMessage = payloadData.type === "audio" && Boolean(payloadData.audio?.voice);

  if (isVoiceMessage) {
    console.log("[VOICE] 13 iniciando envio /messages");
    console.log("[VOICE] 14 usando voice:true");
  }

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${recentMetaVersion(profile.meta_graph_version)}/${profile.whatsapp_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${profile.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildWhatsAppPayload(job.recipient, payloadData)),
      },
    );
  } catch (error) {
    if (isVoiceMessage) {
      console.error("[VOICE ERROR] etapa: POST /messages network");
      console.error(`[VOICE ERROR] mensagem: ${(error as any)?.message || error}`);
    }
    throw networkDispatchError(error);
  }
  const body = await parseResponse(response);

  if (isVoiceMessage) {
    console.log(`[VOICE] 15 resposta HTTP da Meta: ${response.status}`);
  }

  if (!response.ok) {
    if (isVoiceMessage) {
      console.error("[VOICE ERROR] etapa: POST /messages");
      console.error(`[VOICE ERROR] HTTP status: ${response.status}`);
      console.error(`[VOICE ERROR] error.message: ${body?.error?.message}`);
      console.error(`[VOICE ERROR] error.type: ${body?.error?.type}`);
      console.error(`[VOICE ERROR] error.code: ${body?.error?.code}`);
      console.error(`[VOICE ERROR] error.error_subcode: ${body?.error?.error_subcode}`);
      console.error(`[VOICE ERROR] error.error_data: ${JSON.stringify(body?.error?.error_data)}`);
      console.error(`[VOICE ERROR] fbtrace_id: ${body?.error?.fbtrace_id}`);
    }
    throw new DispatchError(
      errorMessage(body, "Falha ao enviar mensagem na Meta."),
      isRetryableMetaError(response.status, body),
      body,
    );
  }

  const messageId = normalizeWaMessageId(body?.messages?.[0]?.id);
  if (isVoiceMessage) {
    console.log(`[VOICE] 16 message_id retornado pela Meta: ${messageId}`);
    console.log("[VOICE] 17 envio concluído");
  }

  return {
    providerMessageId: messageId,
    providerAccountId: profile.whatsapp_phone_number_id,
    responsePayload: body,
  };
}

async function dispatchInstagram(job: ChatOutboxRow): Promise<DispatchResult> {
  const accounts = (await db.query(
    `SELECT ig_user_id, access_token
     FROM instagram_accounts WHERE user_id = ? AND status = 'active' LIMIT 1`,
    [job.user_id],
  )) as Array<{ ig_user_id: string; access_token: string }>;
  const account = accounts[0];
  if (!account || !job.provider_recipient_id) {
    throw new DispatchError("Conta ou destinatário do Instagram indisponível.", false);
  }

  const data = parsePayload(job.payload);
  const result = await sendInstagramMessage({
    igUserId: account.ig_user_id,
    accessToken: account.access_token,
    recipientId: job.provider_recipient_id,
    data,
    replyToMessageId: data.reply_to_message_id,
  });
  if (!result.ok) {
    throw new DispatchError(result.error || "Falha ao enviar DM no Instagram.", true, result.body);
  }
  return {
    providerMessageId: result.wamid,
    providerAccountId: account.ig_user_id,
    responsePayload: result.body,
  };
}

async function dispatchMessenger(job: ChatOutboxRow): Promise<DispatchResult> {
  const pages = (await db.query(
    `SELECT page_id, page_access_token
     FROM facebook_pages WHERE user_id = ? AND status = 'active' LIMIT 1`,
    [job.user_id],
  )) as Array<{ page_id: string; page_access_token: string }>;
  const page = pages[0];
  if (!page || !job.provider_recipient_id) {
    throw new DispatchError("Página ou destinatário do Messenger indisponível.", false);
  }

  const response = await fetch(
    `https://graph.facebook.com/${recentMetaVersion(process.env.META_GRAPH_API_VERSION)}/${page.page_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${page.page_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildMessengerPayload(job.provider_recipient_id, parsePayload(job.payload)),
      ),
    },
  );
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new DispatchError(
      errorMessage(body, "Falha ao enviar mensagem no Messenger."),
      isRetryableMetaError(response.status, body),
      body,
    );
  }
  return {
    providerMessageId: body?.message_id || null,
    providerAccountId: page.page_id,
    responsePayload: body,
  };
}

async function dispatch(job: ChatOutboxRow): Promise<DispatchResult> {
  try {
    if (job.channel === "instagram") return await dispatchInstagram(job);
    if (job.channel === "messenger") return await dispatchMessenger(job);
    return await dispatchWhatsApp(job);
  } catch (error) {
    if (error instanceof DispatchError) throw error;
    throw networkDispatchError(error);
  }
}

export async function enqueueChatOutboxMessage(input: EnqueueChatMessageInput) {
  const messageId = randomUUID();
  const outboxId = randomUUID();

  const result = await db.transaction(async (connection) => {
    const [existingRows] = await connection.query(
      `SELECT id, wa_message_id, status
       FROM direct_messages
       WHERE user_id = ? AND client_message_id = ?
       LIMIT 1`,
      [input.userId, input.clientMessageId],
    );
    const existing = (
      existingRows as Array<{
        id: string;
        wa_message_id?: string | null;
        status?: string | null;
      }>
    )[0];
    if (existing) {
      return {
        messageId: existing.id,
        providerMessageId: existing.wa_message_id || null,
        status: existing.status || "queued",
        duplicate: true,
      };
    }

    await connection.query(
      `INSERT INTO direct_messages
       (id, client_message_id, tenant_id, user_id, contact_phone, direction, type, body,
        status, reply_to_message_id, metadata, channel, provider_account_id)
       VALUES (?, ?, ?, ?, ?, 'outgoing', ?, ?, 'queued', ?, ?, ?, ?)`,
      [
        messageId,
        input.clientMessageId,
        input.tenantId,
        input.userId,
        input.contactPhone,
        input.type,
        input.body,
        input.replyToMessageId || null,
        JSON.stringify(input.metadata),
        input.channel,
        input.providerAccountId || null,
      ],
    );
    await connection.query(
      `INSERT INTO chat_message_outbox
       (id, tenant_id, user_id, message_id, channel, recipient, provider_recipient_id,
        provider_account_id, payload, status, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        outboxId,
        input.tenantId,
        input.userId,
        messageId,
        input.channel,
        input.contactPhone,
        input.providerRecipientId || null,
        input.providerAccountId || null,
        JSON.stringify(input.payload),
      ],
    );

    return {
      messageId,
      providerMessageId: null,
      status: "queued",
      duplicate: false,
    };
  });

  await publishChatRealtimeEvent({
    type: "message.queued",
    tenant_id: input.tenantId,
    contact_phone: input.contactPhone,
    message_id: result.messageId,
    provider_message_id: result.providerMessageId,
    status: result.status,
  });
  return result;
}

async function claimBatch(workerId: string): Promise<ChatOutboxRow[]> {
  return db.transaction(async (connection) => {
    const [rows] = await connection.query(
      `SELECT id, tenant_id, user_id, message_id, channel, recipient,
              provider_recipient_id, provider_account_id, payload, attempts, max_attempts
       FROM chat_message_outbox
       WHERE (
         (status IN ('pending', 'retry') AND next_attempt_at <= NOW())
         OR (status = 'processing' AND locked_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE))
       )
       ORDER BY next_attempt_at ASC, created_at ASC
       LIMIT 10
       FOR UPDATE SKIP LOCKED`,
    );
    const jobs = rows as ChatOutboxRow[];
    if (!jobs.length) return [];

    const placeholders = jobs.map(() => "?").join(",");
    await connection.query(
      `UPDATE chat_message_outbox
       SET status = 'processing', attempts = attempts + 1, locked_at = NOW(), locked_by = ?
       WHERE id IN (${placeholders})`,
      [workerId, ...jobs.map((job) => job.id)],
    );
    return jobs.map((job) => ({ ...job, attempts: Number(job.attempts) + 1 }));
  });
}

function retryDelaySeconds(attempt: number): number {
  return [5, 15, 30, 60, 120][Math.max(0, Math.min(attempt - 1, 4))];
}

async function completeJob(job: ChatOutboxRow, result: DispatchResult) {
  let persistedMessageId = job.message_id;
  await db.transaction(async (connection) => {
    const [echoRows] = result.providerMessageId
      ? await connection.query(
          `SELECT id
           FROM direct_messages
           WHERE user_id = ?
             AND id != ?
             AND (wa_message_id = ? OR provider_message_id = ?)
           LIMIT 1
           FOR UPDATE`,
          [job.user_id, job.message_id, result.providerMessageId, result.providerMessageId],
        )
      : [[]];
    const echoMessage = (echoRows as Array<{ id: string }>)[0];
    persistedMessageId = echoMessage?.id || job.message_id;

    await connection.query(
      `UPDATE chat_message_outbox
       SET status = 'sent', message_id = ?, provider_message_id = ?, response_payload = ?, sent_at = NOW(),
           locked_at = NULL, locked_by = NULL, last_error = NULL
       WHERE id = ?`,
      [
        persistedMessageId,
        result.providerMessageId,
        JSON.stringify(result.responsePayload ?? null),
        job.id,
      ],
    );
    if (echoMessage) {
      await connection.query(
        `UPDATE direct_messages echo_message
         JOIN direct_messages queued_message ON queued_message.id = ?
         SET echo_message.client_message_id = queued_message.client_message_id,
             echo_message.metadata = COALESCE(queued_message.metadata, echo_message.metadata),
             echo_message.status = 'sent'
         WHERE echo_message.id = ? AND echo_message.user_id = ?`,
        [job.message_id, echoMessage.id, job.user_id],
      );
      await connection.query(`DELETE FROM direct_messages WHERE id = ? AND user_id = ?`, [
        job.message_id,
        job.user_id,
      ]);
    } else {
      await connection.query(
        `UPDATE direct_messages
         SET status = 'sent', wa_message_id = ?, provider_message_id = ?, provider_account_id = ?
         WHERE id = ? AND user_id = ?`,
        [
          result.providerMessageId,
          result.providerMessageId,
          result.providerAccountId || job.provider_account_id || null,
          job.message_id,
          job.user_id,
        ],
      );
    }
  });

  await publishChatRealtimeEvent({
    type: "message.sent",
    tenant_id: job.tenant_id,
    contact_phone: job.recipient,
    message_id: persistedMessageId,
    provider_message_id: result.providerMessageId,
    status: "sent",
  });
}

async function failOrRetryJob(job: ChatOutboxRow, error: DispatchError) {
  const shouldRetry = error.retryable && job.attempts < Number(job.max_attempts);
  const serializedResponse = JSON.stringify(error.responsePayload ?? null);

  if (shouldRetry) {
    const delay = retryDelaySeconds(job.attempts);
    await db.query(
      `UPDATE chat_message_outbox
       SET status = 'retry', next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
           last_error = ?, response_payload = ?, locked_at = NULL, locked_by = NULL
       WHERE id = ?`,
      [delay, error.message.slice(0, 65535), serializedResponse, job.id],
    );
    await publishChatRealtimeEvent({
      type: "message.retry",
      tenant_id: job.tenant_id,
      contact_phone: job.recipient,
      message_id: job.message_id,
      status: "queued",
    });
    return;
  }

  await db.transaction(async (connection) => {
    await connection.query(
      `UPDATE chat_message_outbox
       SET status = 'failed', last_error = ?, response_payload = ?,
           locked_at = NULL, locked_by = NULL
       WHERE id = ?`,
      [error.message.slice(0, 65535), serializedResponse, job.id],
    );
    await connection.query(
      `UPDATE direct_messages
       SET status = 'failed',
           metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.send_error', ?)
       WHERE id = ? AND user_id = ?`,
      [error.message.slice(0, 2000), job.message_id, job.user_id],
    );
  });
  await publishChatRealtimeEvent({
    type: "message.failed",
    tenant_id: job.tenant_id,
    contact_phone: job.recipient,
    message_id: job.message_id,
    status: "failed",
  });
}

export async function processChatOutboxBatch(): Promise<number> {
  const workerId = `${process.pid}-${randomUUID()}`;
  const jobs = await claimBatch(workerId);
  await Promise.all(
    jobs.map(async (job) => {
      try {
        await completeJob(job, await dispatch(job));
      } catch (error) {
        const dispatchError =
          error instanceof DispatchError
            ? error
            : new DispatchError(
                error instanceof Error ? error.message : "Falha desconhecida no envio.",
                true,
              );
        console.error("[Chat Outbox] Falha ao processar mensagem.", {
          outboxId: job.id,
          messageId: job.message_id,
          attempt: job.attempts,
          retryable: dispatchError.retryable,
          error: dispatchError.message,
        });
        await failOrRetryJob(job, dispatchError);
      }
    }),
  );
  return jobs.length;
}

interface OutboxWorkerState {
  started: boolean;
  processing: boolean;
}

const globalWorker = globalThis as typeof globalThis & {
  __blivChatOutboxWorker?: OutboxWorkerState;
};

export function startChatOutboxWorker() {
  const state = globalWorker.__blivChatOutboxWorker ?? {
    started: false,
    processing: false,
  };
  globalWorker.__blivChatOutboxWorker = state;
  if (state.started) return;
  state.started = true;

  const drain = async () => {
    if (state.processing) return;
    state.processing = true;
    try {
      let processed = await processChatOutboxBatch();
      while (processed === 10) processed = await processChatOutboxBatch();
    } catch (error) {
      console.error("[Chat Outbox] Worker indisponível.", error);
    } finally {
      state.processing = false;
    }
  };

  console.log("[Chat Outbox] Worker iniciado (intervalo de 1 segundo).");
  setTimeout(() => void drain(), 2_000);
  setInterval(() => void drain(), 1_000);
}
