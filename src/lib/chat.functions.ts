"use server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { buildWhatsAppBotMessage, type WhatsAppBotStep } from "@/lib/meta-whatsapp-message";
import { enqueueChatOutboxMessage } from "@/lib/chat-outbox.server";
import { publishChatRealtimeEvent } from "@/lib/chat-realtime.server";
import { resolveSharedContactsData } from "@/lib/chat-message-content";
import db from "./db";

type JsonValue = string | number | boolean | null | undefined | JsonRecord | JsonValue[];
interface JsonRecord {
  [key: string]: JsonValue;
}
type ChatMessageType = z.infer<typeof sendMessageInput>["type"] | "system" | "media";

interface ChatContactRow extends JsonRecord {
  id: string;
  user_id: string;
  phone_e164: string;
  custom_fields?: string | JsonRecord | null;
  channel?: string | null;
  instagram_id?: string | null;
  whatsapp_number?: string | null;
}

interface ChatContactListItem extends JsonRecord {
  id: string;
  user_id: string;
  phone_e164: string;
  custom_fields: JsonValue;
  channel?: string | null;
  instagram_id?: string | null;
  whatsapp_number?: string | null;
}

interface ChatContactDetailsRow extends JsonRecord {
  id?: string;
  phone_e164?: string | null;
  channel?: string | null;
  bot_active?: boolean | number | null;
}

interface BotStateFlagRow {
  bot_active?: boolean | number | null;
}

interface DirectMessageRow {
  id: string;
  wa_message_id?: string | null;
  provider_message_id?: string | null;
  direction: "incoming" | "outgoing";
  created_at: string;
  type: string;
  body?: string | null;
  status?: string | null;
  sender_name?: string | null;
  sender_wa_id?: string | null;
  reply_to_message_id?: string | null;
  metadata?: JsonValue;
  raw_payload?: JsonValue;
  channel?: string | null;
}

interface AssignmentRow {
  id: string;
  assigned_at: string;
  team_name?: string | null;
  agent_name?: string | null;
  assigned_by_name?: string | null;
}

interface CampaignMessageRow {
  id: string;
  status?: string | null;
  sent_at?: string | null;
  created_at: string;
  campaign_name?: string | null;
}

interface InstagramAccountRow {
  ig_user_id: string;
  access_token: string;
}

interface FacebookPageRow {
  page_id: string;
  page_access_token: string;
}

interface ExternalContactRow {
  external_contact_id?: string | null;
}

interface ProfileMessageRow {
  whatsapp_phone_number_id?: string | null;
  whatsapp_access_token?: string | null;
  meta_graph_version?: string | null;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonRecord(value: unknown): JsonRecord | null {
  return isJsonRecord(value) ? value : null;
}

function asJsonRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isJsonRecord) : [];
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseJsonField<T extends JsonValue | string>(value: T): JsonValue {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return value;
  }
}

const normalizeChatContactId = (value: string) => {
  if (
    value.startsWith("ig_") ||
    value.startsWith("fb_") ||
    value.endsWith("@g.us") ||
    value.endsWith("@temp")
  ) {
    return value;
  }

  return value.replace(/\D/g, "");
};

const sendMessageInput = z.object({
  client_message_id: z.string().uuid().optional(),
  to: z.string().trim().min(8).max(40),
  type: z.enum([
    "text",
    "reaction",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "location",
    "contacts",
  ]),
  text: z
    .object({
      body: z.string(),
      preview_url: z.boolean().default(false),
    })
    .optional(),
  reaction: z
    .object({
      message_id: z.string(),
      emoji: z.string(),
    })
    .optional(),
  image: z
    .object({
      id: z.string().optional(),
      link: z.string().optional(),
    })
    .optional(),
  audio: z
    .object({
      id: z.string().optional(),
      link: z.string().optional(),
      voice: z.boolean().optional(),
    })
    .optional(),
  video: z
    .object({
      id: z.string().optional(),
      link: z.string().optional(),
    })
    .optional(),
  document: z
    .object({
      id: z.string().optional(),
      link: z.string().optional(),
      filename: z.string().trim().min(1),
    })
    .optional(),
  sticker: z
    .object({
      id: z.string().optional(),
      link: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        name: z.object({
          formatted_name: z.string(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        }),
        phones: z.array(
          z.object({
            phone: z.string(),
            type: z.string().optional(),
          }),
        ),
      }),
    )
    .optional(),
  local_media: z
    .object({
      path: z.string().trim().min(1).max(1024),
      mime_type: z.string().trim().min(1).max(255),
      filename: z.string().trim().min(1).max(512),
      size: z.number().int().nonnegative(),
    })
    .optional(),
  reply_to_message_id: z.string().optional(),
}).superRefine((value, ctx) => {
  const requireMediaReference = (
    media: { id?: string; link?: string } | undefined,
    path: "image" | "audio" | "video" | "document" | "sticker",
  ) => {
    if (!media?.id?.trim() && !media?.link?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [path],
        message: `Informe o ID ou link da mídia para ${path}.`,
      });
    }
  };

  if (value.type === "text" && !value.text?.body.trim()) {
    ctx.addIssue({ code: "custom", path: ["text", "body"], message: "A mensagem está vazia." });
  }
  if (value.type === "reaction" && (!value.reaction?.message_id || value.reaction.emoji === undefined)) {
    ctx.addIssue({ code: "custom", path: ["reaction"], message: "Reação inválida." });
  }
  if (value.type === "image") requireMediaReference(value.image, "image");
  if (value.type === "audio") requireMediaReference(value.audio, "audio");
  if (value.type === "video") requireMediaReference(value.video, "video");
  if (value.type === "document" && !value.document) {
    ctx.addIssue({
      code: "custom",
      path: ["document"],
      message: "Documento e nome do arquivo são obrigatórios.",
    });
  } else if (value.type === "document") {
    requireMediaReference(value.document, "document");
  }
  if (value.type === "sticker") requireMediaReference(value.sticker, "sticker");
  if (value.type === "location") {
    const latitude = value.location?.latitude;
    const longitude = value.location?.longitude;
    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      ctx.addIssue({ code: "custom", path: ["location"], message: "Localização inválida." });
    }
  }
  if (value.type === "contacts" && !value.contacts?.length) {
    ctx.addIssue({ code: "custom", path: ["contacts"], message: "Informe ao menos um contato." });
  }
});

export const listChatContacts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const effectiveUserId = await resolveEffectiveUserId(context.userId);
      const contacts = (await db.query(
        `
        SELECT 
          c.id, 
          c.user_id,
          c.name, 
          c.phone_e164, 
          c.custom_fields,
          c.email,
          c.source,
          c.opted_out,
          c.is_pinned,
          c.is_archived,
          c.chat_status,
          c.is_unread,
          c.kanban_stage_id,
          c.channel,
          c.created_at,
          c.updated_at,
          COALESCE(bcs.bot_active, 1) AS bot_active,
          last_dm.body AS last_message_body,
          last_dm.type AS last_message_type,
          last_dm.direction AS last_message_direction,
          COALESCE(last_dm.created_at, last_cm.sent_at) AS last_message_time,
          GREATEST(COALESCE(c.is_unread, 0), COALESCE(unread.cnt, 0)) AS unread_count,
          ca.team_id AS active_team_id,
          ca.agent_id AS active_agent_id,
          t.name AS active_team_name,
          COALESCE(p.full_name, p.display_name, u.email) AS active_agent_name,
          s.name AS kanban_stage_name,
          s.color AS kanban_stage_color
        FROM contacts c
        LEFT JOIN bot_conversation_state bcs 
          ON bcs.user_id = c.user_id AND bcs.contact_number = c.phone_e164 AND bcs.channel = c.channel
        LEFT JOIN (
          SELECT tenant_id, user_id, contact_phone, body, type, direction, created_at
          FROM (
            SELECT tenant_id, user_id, contact_phone, body, type, direction, created_at,
                   ROW_NUMBER() OVER(PARTITION BY COALESCE(tenant_id, user_id), contact_phone ORDER BY created_at DESC) as rn
            FROM direct_messages
          ) tmp WHERE rn = 1
        ) last_dm ON (last_dm.tenant_id = c.tenant_id OR last_dm.user_id = c.user_id) AND last_dm.contact_phone = c.phone_e164
        LEFT JOIN (
          SELECT COALESCE(tenant_id, user_id) as owner_id, contact_phone, COUNT(*) as cnt
          FROM direct_messages
          WHERE direction = 'incoming' AND (status IS NULL OR status != 'read')
          GROUP BY COALESCE(tenant_id, user_id), contact_phone
        ) unread ON (unread.owner_id = c.tenant_id OR unread.owner_id = c.user_id) AND unread.contact_phone = c.phone_e164
        LEFT JOIN (
          SELECT user_id, to_phone, MAX(sent_at) as sent_at
          FROM campaign_messages
          GROUP BY user_id, to_phone
        ) last_cm ON last_cm.user_id = c.user_id AND last_cm.to_phone = c.phone_e164
        LEFT JOIN conversation_assignments ca 
          ON ca.contact_phone = c.phone_e164 AND ca.user_id = c.user_id AND ca.is_active = true
        LEFT JOIN teams t ON t.id = ca.team_id
        LEFT JOIN users u ON u.id = ca.agent_id
        LEFT JOIN profiles p ON p.id = u.id
        LEFT JOIN sales_stages s ON s.id = c.kanban_stage_id
        WHERE (c.user_id = ? OR c.tenant_id = ?)
          AND (
            last_dm.created_at IS NOT NULL
            OR last_cm.sent_at IS NOT NULL
            OR c.channel = 'whatsapp_group'
            OR EXISTS (
              SELECT 1
              FROM chat_sessions cs
              WHERE cs.user_id = c.user_id
                AND cs.contact_id = c.id
                AND cs.closed_at IS NULL
            )
          )
        ORDER BY 
          c.is_pinned DESC,
          COALESCE(last_dm.created_at, last_cm.sent_at, c.created_at) DESC
      `,
        [effectiveUserId, effectiveUserId],
      )) as ChatContactRow[];

      const normalizedContacts: ChatContactListItem[] = (contacts ?? []).map((c) => ({
        ...c,
        custom_fields: parseJsonField(c.custom_fields ?? null),
      }));

      return normalizedContacts;
    } catch (e: unknown) {
      console.error("Erro ao listar contatos com mensagens:", e);
      throw new Error(e instanceof Error && e.message ? e.message : "Erro ao consultar contatos");
    }
  });

export const markMessagesAsRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = normalizeChatContactId(data.phone);
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const latestIncoming = (await db.query(
      `SELECT wa_message_id, provider_account_id, channel
       FROM direct_messages
       WHERE (user_id = ? OR tenant_id = ?) AND contact_phone = ? AND direction = 'incoming'
         AND wa_message_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [effectiveUserId, effectiveUserId, phone],
    )) as Array<{
      wa_message_id?: string | null;
      provider_account_id?: string | null;
      channel?: string | null;
    }>;

    await db.query(
      `UPDATE direct_messages SET status = 'read'
       WHERE (user_id = ? OR tenant_id = ?) AND contact_phone = ? AND direction = 'incoming' AND (status IS NULL OR status != 'read')`,
      [effectiveUserId, effectiveUserId, phone],
    );

    await db.query(
      `UPDATE contacts SET is_unread = false
       WHERE (user_id = ? OR tenant_id = ?) AND phone_e164 = ?`,
      [effectiveUserId, effectiveUserId, phone],
    );

    const incomingMessage = latestIncoming[0];
    await publishChatRealtimeEvent({
      type: "message.status",
      tenant_id: effectiveUserId,
      contact_phone: phone,
      message_id: incomingMessage?.wa_message_id || null,
      provider_message_id: incomingMessage?.wa_message_id || null,
      status: "read",
    });

    if (incomingMessage?.channel === "whatsapp" && incomingMessage.wa_message_id) {
      try {
        const profiles = (await db.query(
          `SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version
           FROM profiles WHERE id = ? LIMIT 1`,
          [effectiveUserId],
        )) as ProfileMessageRow[];
        const profile = profiles[0];
        const phoneNumberId =
          incomingMessage.provider_account_id || profile?.whatsapp_phone_number_id;
        if (phoneNumberId && profile?.whatsapp_access_token) {
          let apiVersion = profile.meta_graph_version || "v26.0";
          if (apiVersion.startsWith("v") && parseFloat(apiVersion.slice(1)) < 24.0) {
            apiVersion = "v26.0";
          }
          const response = await fetch(
            `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${profile.whatsapp_access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                status: "read",
                message_id: incomingMessage.wa_message_id,
              }),
            },
          );
          if (!response.ok) {
            console.warn("Não foi possível confirmar leitura da mensagem na Meta.", {
              status: response.status,
              messageId: incomingMessage.wa_message_id,
            });
          }
        }
      } catch (error) {
        console.warn("Falha não bloqueante ao confirmar leitura na Meta.", error);
      }
    }

    return { ok: true };
  });

export const getChatContactDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        phone: z.string().trim().min(5).optional(),
        contactId: z.string().uuid().optional(),
      })
      .refine((value) => Boolean(value.phone || value.contactId), "Informe o contato ou telefone")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const phone = data.phone ? normalizeChatContactId(data.phone) : null;
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      `SELECT *
       FROM contacts
       WHERE (user_id = ? OR tenant_id = ?)
         AND (
           (? IS NOT NULL AND id = ?)
           OR (? IS NOT NULL AND (
             phone_e164 = ?
             OR REGEXP_REPLACE(phone_e164, '[^0-9]', '') = ?
           ))
         )
       LIMIT 1`,
      [
        effectiveUserId,
        effectiveUserId,
        data.contactId ?? null,
        data.contactId ?? null,
        phone,
        phone,
        phone,
      ],
    )) as ChatContactDetailsRow[];
    const contact = contacts?.[0] ?? null;

    if (contact) {
      const botStates = (await db.query(
        `SELECT bot_active FROM bot_conversation_state
         WHERE user_id = ? AND contact_number = ? AND channel = ?
         ORDER BY updated_at DESC LIMIT 1`,
        [contact.user_id, phone ?? normalizeChatContactId(contact.phone_e164 ?? ""), contact.channel],
      )) as BotStateFlagRow[];
      contact.bot_active = botStates?.[0] ? !!botStates[0].bot_active : true;
    }

    return contact ?? null;
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = normalizeChatContactId(data.phone);
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    console.log("[MESSAGES] Buscando mensagens para:", { phone, effectiveUserId, userId: context.userId });

    // O chat não precisa trazer anos de mensagens para abrir uma única
    // conversa. O limite evita que uma tabela grande deixe a interface em
    // carregamento indefinido. Inverte no JS para evitar estourar o sort_buffer.
    const baseMessagesQuery = `SELECT id, direction, created_at, body, status
       FROM direct_messages
       WHERE (user_id = ? OR tenant_id = ?) AND contact_phone = ?
       ORDER BY created_at DESC
       LIMIT 500`;
    const richMessagesQuery = `SELECT id, wa_message_id, provider_message_id, direction, created_at, type, body, status,
              reply_to_message_id, metadata, raw_payload, channel, sender_name, sender_wa_id
       FROM direct_messages
       WHERE (user_id = ? OR tenant_id = ?) AND contact_phone = ?
       ORDER BY created_at DESC
       LIMIT 500`;

    let messages: unknown[];
    try {
      messages = (await db.query(richMessagesQuery, [effectiveUserId, effectiveUserId, phone])) as unknown[];
      console.log("[MESSAGES] Query rich executada com sucesso:", { messageCount: messages?.length });
    } catch (error) {
      console.warn(
        "Schema legado em direct_messages; carregando a conversa com as colunas-base.",
        error,
      );
      messages = (await db.query(baseMessagesQuery, [effectiveUserId, effectiveUserId, phone])) as unknown[];
      console.log("[MESSAGES] Query base executada com sucesso:", { messageCount: messages?.length });
    }

    // Históricos auxiliares não podem impedir a abertura das mensagens.
    // Instalações ainda em migração podem não ter todas as colunas
    // dessas tabelas, enquanto direct_messages continua plenamente utilizável.
    const [assignmentsResult, campaignMessagesResult] = await Promise.allSettled([
      db.query(
        `SELECT 
        ca.id,
        ca.assigned_at,
        t.name as team_name,
        COALESCE(p_agent.full_name, p_agent.display_name, u_agent.email) as agent_name,
        COALESCE(p_by.full_name, p_by.display_name, u_by.email) as assigned_by_name
       FROM conversation_assignments ca
       LEFT JOIN teams t ON t.id = ca.team_id
       LEFT JOIN users u_agent ON u_agent.id = ca.agent_id
       LEFT JOIN profiles p_agent ON p_agent.id = u_agent.id
       LEFT JOIN users u_by ON u_by.id = ca.assigned_by
       LEFT JOIN profiles p_by ON p_by.id = u_by.id
       WHERE ca.user_id = ? AND ca.contact_phone = ?
       ORDER BY ca.assigned_at DESC
       LIMIT 200`,
        [effectiveUserId, phone],
      ),
      db.query(
        `SELECT cm.id, cm.status, cm.sent_at, cm.created_at, c.name AS campaign_name
       FROM campaign_messages cm
       LEFT JOIN campaigns c ON c.id = cm.campaign_id AND c.user_id = cm.user_id
       WHERE cm.user_id = ? AND cm.to_phone = ?
       ORDER BY COALESCE(cm.sent_at, cm.created_at) DESC
       LIMIT 200`,
        [effectiveUserId, phone],
      ),
    ]);
    if (assignmentsResult.status === "rejected") {
      console.error("Erro ao carregar atribuições da conversa:", assignmentsResult.reason);
    }
    if (campaignMessagesResult.status === "rejected") {
      console.error("Erro ao carregar campanhas da conversa:", campaignMessagesResult.reason);
    }

    const assignments = assignmentsResult.status === "fulfilled" ? assignmentsResult.value : [];
    const campaignMessages =
      campaignMessagesResult.status === "fulfilled" ? campaignMessagesResult.value : [];
    const typedMessages = (messages ?? []) as DirectMessageRow[];
    const reactionCount = typedMessages.filter((m) => m.type === "reaction").length;
    const whatsappMessages = typedMessages.filter((m) => m.channel === "whatsapp");
    const instagramMessages = typedMessages.filter((m) => m.channel === "instagram");
    
    console.log(`[MESSAGES] ${typedMessages.length} mensagens carregadas para ${phone}:`, {
      total: typedMessages.length,
      whatsapp: whatsappMessages.length,
      instagram: instagramMessages.length,
      reactions: reactionCount,
      canais: [...new Set(typedMessages.map(m => m.channel))]
    });

    const typedAssignments = (assignments ?? []) as AssignmentRow[];
    const typedCampaignMessages = (campaignMessages ?? []) as CampaignMessageRow[];

    const botStepsById = new Map<string, WhatsAppBotStep>();
    const botStepsByContent = new Map<string, WhatsAppBotStep>();
    const botStepIds = Array.from(
      new Set(
        typedMessages
          .map((row) => getStringValue(asJsonRecord(row.metadata)?.step_id))
          .filter((stepId): stepId is string => Boolean(stepId)),
      ),
    );
    const outgoingBotBodies = Array.from(
      new Set(
        typedMessages
          .filter((row) => row.direction === "outgoing")
          .map((row) => row.body?.trim())
          .filter((body): body is string => Boolean(body)),
      ),
    );
    if (botStepIds.length > 0 || outgoingBotBodies.length > 0) {
      try {
        const stepConditions: string[] = [];
        const stepParams: unknown[] = [effectiveUserId, effectiveUserId];
        if (botStepIds.length > 0) {
          stepConditions.push(`id IN (${botStepIds.map(() => "?").join(", ")})`);
          stepParams.push(...botStepIds);
        }
        if (outgoingBotBodies.length > 0) {
          stepConditions.push(
            `message_content IN (${outgoingBotBodies.map(() => "?").join(", ")})`,
          );
          stepParams.push(...outgoingBotBodies);
        }
        const botSteps = (await db.query(
          `SELECT id, message_type, message_content, media_url, media_caption,
                  footer_text, buttons_config
           FROM bot_steps
           WHERE (user_id = ? OR tenant_id = ?)
             AND (${stepConditions.join(" OR ")})`,
          stepParams,
        )) as Array<WhatsAppBotStep & { id: string }>;
        botSteps.forEach((step) => {
          botStepsById.set(step.id, step);
          const content = step.message_content?.trim();
          if (content) botStepsByContent.set(content, step);
        });
      } catch (error) {
        console.warn("Não foi possível reconstruir os cartões antigos do bot.", error);
      }
    }

    const formattedMessages = typedMessages.map((row: any) => {
      const storedMeta = asJsonRecord(parseJsonField(row.metadata));
      const stepId = getStringValue(storedMeta?.step_id);
      const botStep =
        (stepId ? botStepsById.get(stepId) : null) ||
        (row.direction === "outgoing" && row.body
          ? botStepsByContent.get(row.body.trim())
          : null);
      const rebuiltMessage = botStep ? buildWhatsAppBotMessage(phone, botStep) : null;
      const rebuiltPayload = rebuiltMessage?.ok
        ? asJsonRecord(parseJsonField(JSON.stringify(rebuiltMessage.payload)))
        : null;
      const rebuiltBuildMeta = rebuiltMessage?.ok
        ? asJsonRecord(parseJsonField(JSON.stringify(rebuiltMessage.meta)))
        : null;
      const meta: JsonRecord | null =
        rebuiltPayload && !asJsonRecord(storedMeta?.payload)
          ? {
              ...(storedMeta ?? {}),
              payload: rebuiltPayload,
              message_build: rebuiltBuildMeta,
            }
          : storedMeta;
      const rawPayload = asJsonRecord(parseJsonField(row.raw_payload));
      const metaMessage = asJsonRecord(meta?.message);
      const rawMessages = asJsonRecordArray(rawPayload?.messages);
      const rawMessage =
        metaMessage ||
        rawMessages.find((m) => getStringValue(m.id) === row.wa_message_id) ||
        rawMessages[0] ||
        null;
      const imageData = asJsonRecord(meta?.image) || asJsonRecord(rawMessage?.image) || null;
      const audioData = asJsonRecord(meta?.audio) || asJsonRecord(rawMessage?.audio) || null;
      const videoData = asJsonRecord(meta?.video) || asJsonRecord(rawMessage?.video) || null;
      const documentData =
        asJsonRecord(meta?.document) || asJsonRecord(rawMessage?.document) || null;
      const stickerData = asJsonRecord(meta?.sticker) || asJsonRecord(rawMessage?.sticker) || null;
      const locationData =
        asJsonRecord(meta?.location) ||
        asJsonRecord(metaMessage?.location) ||
        asJsonRecord(rawMessage?.location) ||
        null;
      // Em webhooks da Meta, `value.contacts` descreve o remetente e existe
      // também em mensagens de texto/mídia. Versões anteriores salvaram esse
      // array em `metadata.contacts`; ele só pode ser tratado como conteúdo
      // quando a própria linha foi persistida com type="contacts".
      const contactsData = resolveSharedContactsData<JsonValue>(
        row.type,
        meta,
        metaMessage,
        rawMessage,
      );
      const reactionData =
        asJsonRecord(meta?.reaction) ||
        asJsonRecord(rawMessage?.reaction) ||
        (row.type === "reaction" ? { emoji: row.body, message_id: row.reply_to_message_id } : null);
      let messageType = (row.type || "text") as ChatMessageType;
      if (messageType === "text" || messageType === "media" || !messageType) {
        if (imageData || meta?.image || rawMessage?.type === "image") messageType = "image";
        else if (videoData || meta?.video || rawMessage?.type === "video") messageType = "video";
        else if (audioData || meta?.audio || rawMessage?.type === "audio") messageType = "audio";
        else if (documentData || meta?.document || rawMessage?.type === "document") messageType = "document";
        else if (stickerData || meta?.sticker || rawMessage?.type === "sticker") messageType = "sticker";
        else if (locationData || meta?.location || rawMessage?.type === "location") messageType = "location";
        else if (contactsData || rawMessage?.type === "contacts") messageType = "contacts";
      }

      return {
        id: row.id,
        wa_message_id: row.wa_message_id || null,
        provider_message_id: row.provider_message_id || null,
        direction: (row.direction || "incoming") as "incoming" | "outgoing",
        timestamp: row.created_at,
        type: messageType,
        body: row.body,
        status: row.status || null,
        sender_name: row.sender_name || null,
        sender_wa_id: row.sender_wa_id || null,
        reaction: messageType === "reaction" ? reactionData : null,
        image:
          messageType === "image" || imageData
            ? (imageData ? { id: imageData.id, link: imageData.link || meta?.media_url, caption: imageData.caption, mime_type: imageData.mime_type } : (meta?.media_url ? { link: meta.media_url } : (row.body ? { id: row.body } : null)))
            : null,
        audio:
          messageType === "audio" || audioData
            ? (audioData ? { id: audioData.id, link: audioData.link || meta?.media_url, mime_type: audioData.mime_type } : (meta?.media_url ? { link: meta.media_url } : (row.body ? { id: row.body } : null)))
            : null,
        video:
          messageType === "video" || videoData
            ? (videoData ? { id: videoData.id, link: videoData.link || meta?.media_url, caption: videoData.caption, mime_type: videoData.mime_type } : (meta?.media_url ? { link: meta.media_url } : (row.body ? { id: row.body } : null)))
            : null,
        document:
          messageType === "document" || documentData
            ? (documentData ? { id: documentData.id, link: documentData.link || meta?.media_url, filename: documentData.filename, caption: documentData.caption, mime_type: documentData.mime_type } : (meta?.media_url ? { link: meta.media_url } : (row.body ? { id: row.body } : null)))
            : null,
        sticker:
          messageType === "sticker" || stickerData
            ? (stickerData ? { id: stickerData.id, link: stickerData.link || meta?.media_url, mime_type: stickerData.mime_type } : (meta?.media_url ? { link: meta.media_url } : (row.body ? { id: row.body } : null)))
            : null,
        location: messageType === "location" ? locationData : null,
        contacts: messageType === "contacts" ? contactsData : null,
        context: row.reply_to_message_id ? { message_id: row.reply_to_message_id } : null,
        metadata: meta || rawPayload || null,
        channel: row.channel || null,
      };
    });

    const formattedAssignments = typedAssignments.map((a) => {
      let body = "";
      const teamLabel = a.team_name ? ` (${a.team_name.toUpperCase()})` : "";

      if (a.assigned_by_name) {
        if (a.agent_name) {
          body = `${a.assigned_by_name} atribuiu conversa a ${a.agent_name}${teamLabel}`;
        } else if (a.team_name) {
          body = `${a.assigned_by_name} atribuiu conversa à equipe ${a.team_name.toUpperCase()}`;
        } else {
          body = `${a.assigned_by_name} removeu a atribuição da conversa`;
        }
      } else {
        if (a.agent_name) {
          body = `Conversa atribuída a ${a.agent_name}${teamLabel}`;
        } else if (a.team_name) {
          body = `Conversa atribuída à equipe ${a.team_name.toUpperCase()}`;
        } else {
          body = `Conversa desalocada`;
        }
      }

      return {
        id: `assign-${a.id}`,
        direction: "incoming" as const,
        timestamp: a.assigned_at,
        type: "system" as const,
        body: body,
        status: null,
        reaction: null,
        image: null,
        audio: null,
        video: null,
        document: null,
        sticker: null,
        location: null,
        contacts: null,
        context: null,
        metadata: null,
      };
    });

    const formattedCampaignMessages = typedCampaignMessages.map((m) => ({
      id: `campaign-${m.id}`,
      direction: "outgoing" as const,
      timestamp: m.sent_at || m.created_at,
      type: "system" as const,
      body: `Campanha enviada${m.campaign_name ? `: ${m.campaign_name}` : ""}`,
      status: m.status || null,
      reaction: null,
      image: null,
      audio: null,
      video: null,
      document: null,
      sticker: null,
      location: null,
      contacts: null,
      context: null,
      metadata: { source: "campaign", campaign_name: m.campaign_name || null },
    }));

    const allMessages = [
      ...formattedMessages,
      ...formattedAssignments,
      ...formattedCampaignMessages,
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    return allMessages;
  });

export const sendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => sendMessageInput.parse(d))
  .handler(async ({ data, context }) => {
    const isInstagram = data.to.startsWith("ig_");
    const isMessenger = data.to.startsWith("fb_");
    const digits = isInstagram || isMessenger ? data.to : data.to.replace(/\D/g, "");
    if (digits.length < 5) return { ok: false, error: "Identificador do destinatário inválido." };

    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    let localMediaUrl: string | null = null;
    if (data.local_media) {
      const normalizedPath = data.local_media.path
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (
        normalizedPath.includes("..") ||
        !normalizedPath.startsWith(`${effectiveUserId}/`)
      ) {
        return { ok: false, error: "Referência de mídia local inválida." };
      }
      localMediaUrl = `/api/storage/file?path=${encodeURIComponent(normalizedPath)}`;
    }

    const referencedMessageId =
      data.type === "reaction" ? data.reaction?.message_id : data.reply_to_message_id;
    if (referencedMessageId) {
      const referencedMessages = (await db.query(
        `SELECT id
         FROM direct_messages
         WHERE (user_id = ? OR tenant_id = ?)
           AND contact_phone = ?
           AND (wa_message_id = ? OR provider_message_id = ?)
         LIMIT 1`,
        [effectiveUserId, effectiveUserId, digits, referencedMessageId, referencedMessageId],
      )) as Array<{ id: string }>;
      if (!referencedMessages[0]) {
        return {
          ok: false,
          error: "A mensagem respondida não pertence a esta conversa ou não está mais disponível.",
        };
      }
    }

    const messageChannel = isInstagram ? "instagram" : isMessenger ? "messenger" : "whatsapp";
    let providerRecipientId: string | null = null;
    let providerAccountId: string | null = null;

    if (isInstagram) {
      const igAccounts = (await db.query(
        `SELECT instagram_business_account_id as ig_user_id, access_token
         FROM instagram_accounts
         WHERE (user_id = ? OR tenant_id = ?) AND is_active = 1
         ORDER BY (user_id = ?) DESC
         LIMIT 1`,
        [effectiveUserId, effectiveUserId, effectiveUserId],
      )) as InstagramAccountRow[];
      const account = igAccounts?.[0];

      if (!account) {
        return { ok: false, error: "Nenhuma conta profissional do Instagram conectada." };
      }

      const contacts = (await db.query(
        `SELECT external_contact_id FROM contacts
         WHERE (user_id = ? OR tenant_id = ?) AND phone_e164 = ? LIMIT 1`,
        [effectiveUserId, effectiveUserId, digits],
      )) as ExternalContactRow[];
      const externalId = contacts?.[0]?.external_contact_id;
      if (!externalId) {
        return { ok: false, error: "Contato do Instagram sem external_contact_id." };
      }

      providerRecipientId = externalId;
      providerAccountId = account.ig_user_id;
    } else if (isMessenger) {
      // 1. Busca página do Facebook conectada
      const fbPages = (await db.query(
        `SELECT page_id, page_access_token FROM facebook_pages WHERE user_id = ? AND status = 'active' LIMIT 1`,
        [effectiveUserId],
      )) as FacebookPageRow[];
      const page = fbPages?.[0];

      if (!page) {
        return { ok: false, error: "Nenhuma página do Facebook conectada." };
      }

      // 2. Busca o external_contact_id
      const contacts = (await db.query(
        `SELECT external_contact_id FROM contacts
         WHERE (user_id = ? OR tenant_id = ?) AND phone_e164 = ? LIMIT 1`,
        [effectiveUserId, effectiveUserId, digits],
      )) as ExternalContactRow[];
      const externalId = contacts?.[0]?.external_contact_id;
      if (!externalId) {
        return { ok: false, error: "Contato do Messenger sem external_contact_id." };
      }

      providerRecipientId = externalId;
      providerAccountId = page.page_id;
    } else {
      // Envio via WhatsApp
      const profiles = (await db.query(
        `SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version
         FROM profiles WHERE id = ? LIMIT 1`,
        [effectiveUserId],
      )) as ProfileMessageRow[];
      const profile = profiles?.[0];

      if (!profile?.whatsapp_phone_number_id || !profile?.whatsapp_access_token) {
        return { ok: false, error: "Credenciais de API não configuradas em Configurações." };
      }

      if (data.type === "reaction") {
        if (!data.reaction?.message_id?.startsWith("wamid.")) {
          return {
            ok: false,
            error: "A reação exige o wamid original da mensagem do WhatsApp.",
          };
        }
      }
      providerAccountId = profile.whatsapp_phone_number_id || null;
    }

    let bodyText = "";
    if (data.type === "text") {
      bodyText = data.text?.body || "";
    } else if (data.type === "reaction") {
      bodyText = data.reaction?.emoji || "";
    } else if (data.type === "image") {
      bodyText = data.image?.id || data.image?.link || "";
    } else if (data.type === "audio") {
      bodyText = data.audio?.id || data.audio?.link || "";
    } else if (data.type === "video") {
      bodyText = data.video?.id || data.video?.link || "";
    } else if (data.type === "document") {
      bodyText = data.document?.filename || data.document?.id || data.document?.link || "";
    } else if (data.type === "sticker") {
      bodyText = data.sticker?.id || data.sticker?.link || "";
    } else if (data.type === "location") {
      bodyText = data.location?.name || `${data.location?.latitude}, ${data.location?.longitude}`;
    } else if (data.type === "contacts") {
      bodyText = data.contacts?.[0]?.name?.formatted_name || "Contato";
    }

    // 4. Registra a mensagem enviada na tabela direct_messages (bypass auto-scope)
    const localMediaFields = data.local_media
      ? {
          link: localMediaUrl,
          mime_type: data.local_media.mime_type,
          filename: data.local_media.filename,
          file_size: data.local_media.size,
        }
      : {};
    const metadata = {
      text: data.text,
      reaction: data.reaction,
      image: data.image ? { ...data.image, ...localMediaFields } : undefined,
      audio: data.audio ? { ...data.audio, ...localMediaFields } : undefined,
      video: data.video ? { ...data.video, ...localMediaFields } : undefined,
      document: data.document ? { ...data.document, ...localMediaFields } : undefined,
      sticker: data.sticker ? { ...data.sticker, ...localMediaFields } : undefined,
      location: data.location,
      contacts: data.contacts,
      media_url: localMediaUrl,
      local_file_path: data.local_media?.path,
      mime_type: data.local_media?.mime_type,
      file_size: data.local_media?.size,
      original_filename: data.local_media?.filename,
    };
    // 4. Se houver resposta (reply_to_message_id) para mensagem direta, valida e resolve o wamid original
    let targetReplyToId =
      data.type === "reaction"
        ? (data.reaction?.message_id || data.reply_to_message_id)
        : data.reply_to_message_id;

    if (targetReplyToId && data.type !== "reaction") {
      try {
        const rows = (await db.query(
          `SELECT id, wa_message_id FROM direct_messages
           WHERE (user_id = ? OR tenant_id = ?) AND contact_phone = ?
             AND (id = ? OR wa_message_id = ?) LIMIT 1`,
          [effectiveUserId, effectiveUserId, digits, targetReplyToId, targetReplyToId],
        )) as Array<{ id: string; wa_message_id?: string | null }>;
        const originalMsg = rows?.[0];
        if (originalMsg) {
          // Utiliza o wamid oficial para a Meta Cloud API (se disponível) ou mantém a referência encontrada
          targetReplyToId = originalMsg.wa_message_id || originalMsg.id || targetReplyToId;
        } else {
          console.warn(
            `[REPLY] Mensagem respondida "${targetReplyToId}" não encontrada para o contato ${digits}. Enviando sem contexto.`,
          );
          targetReplyToId = undefined;
        }
      } catch (err) {
        console.warn("[REPLY] Erro ao buscar mensagem original:", err);
      }
    }

    if (data.type === "reaction") {
      console.log(
        `[REACTION] Enviando reação outbound. Emoji: "${data.reaction?.emoji || ""}", Target Message ID: "${targetReplyToId}", Destino: "${digits}"`,
      );
    }

    const queuedMessage = await enqueueChatOutboxMessage({
      tenantId: effectiveUserId,
      userId: effectiveUserId,
      clientMessageId: data.client_message_id || crypto.randomUUID(),
      contactPhone: digits,
      channel: messageChannel,
      providerRecipientId,
      providerAccountId,
      type: data.type,
      body: bodyText,
      replyToMessageId: targetReplyToId,
      metadata,
      payload: {
        type: data.type,
        text: data.text,
        reaction: data.reaction,
        image: data.image,
        audio: data.audio,
        video: data.video,
        document: data.document,
        sticker: data.sticker,
        location: data.location,
        contacts: data.contacts,
        reply_to_message_id: targetReplyToId,
      },
    });

    // 5. Intervenção humana: pausa o bot e renova o prazo a cada mensagem do atendente.
    try {
      const botSettings = (await db.query(
      `SELECT instance_id, pause_timeout_minutes
       FROM bot_settings
       WHERE user_id = ? AND channel = ?
       LIMIT 1`,
      [effectiveUserId, messageChannel],
    )) as Array<{ instance_id?: string | null; pause_timeout_minutes?: number | null }>;
      const configuredMinutes = Number(botSettings[0]?.pause_timeout_minutes ?? 60);
      const pauseMinutes = Number.isFinite(configuredMinutes)
        ? Math.min(Math.max(Math.trunc(configuredMinutes), 1), 7 * 24 * 60)
        : 60;
      const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000);
      const stateRows = (await db.query(
      `SELECT id
       FROM bot_conversation_state
       WHERE user_id = ? AND contact_number = ? AND channel = ?
       LIMIT 1`,
      [effectiveUserId, digits, messageChannel],
    )) as Array<{ id: string }>;

      if (stateRows[0]) {
        await db.query(
        `UPDATE bot_conversation_state
         SET tenant_id = COALESCE(tenant_id, ?), is_paused = true, paused_until = ?
         WHERE id = ? AND user_id = ?`,
        [effectiveUserId, pausedUntil, stateRows[0].id, effectiveUserId],
      );
      } else {
        await db.query(
        `INSERT INTO bot_conversation_state
         (id, tenant_id, user_id, contact_number, instance_id, channel, bot_active, is_paused, paused_until)
         VALUES (?, ?, ?, ?, ?, ?, true, true, ?)`,
        [
          crypto.randomUUID(),
          effectiveUserId,
          effectiveUserId,
          digits,
          botSettings[0]?.instance_id || providerAccountId || "default",
          messageChannel,
          pausedUntil,
        ],
        );
      }
    } catch (error) {
      console.warn("Não foi possível pausar o bot após enfileirar a mensagem.", error);
    }

    return {
      ok: true,
      queued: queuedMessage.status === "queued",
      duplicate: queuedMessage.duplicate,
      message_id: queuedMessage.messageId,
      wamid: queuedMessage.providerMessageId,
      status: queuedMessage.status,
    };
  });

export const getConfiguredChannels = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tenantId = context.userId;

    const [whatsappRows, instagramRows, messengerRows] = await Promise.all([
      db.query(
        `SELECT 1 FROM profiles WHERE id = ? AND whatsapp_phone_number_id IS NOT NULL AND whatsapp_phone_number_id <> '' LIMIT 1`,
        [tenantId],
      ) as Promise<Array<{ 1: number }>>,
      db.query(
        `SELECT 1 FROM instagram_accounts WHERE tenant_id = ? AND access_token IS NOT NULL AND access_token <> '' AND instagram_business_account_id IS NOT NULL AND instagram_business_account_id <> '' LIMIT 1`,
        [tenantId],
      ) as Promise<Array<{ 1: number }>>,
      db.query(
        `SELECT 1 FROM facebook_pages WHERE user_id = ? AND page_access_token IS NOT NULL AND page_access_token <> '' AND page_id IS NOT NULL AND page_id <> '' LIMIT 1`,
        [tenantId],
      ) as Promise<Array<{ 1: number }>>,
    ]);

    return {
      channels: [
        "all",
        ...(whatsappRows.length > 0 ? ["whatsapp"] : []),
        ...(instagramRows.length > 0 ? ["instagram"] : []),
        ...(messengerRows.length > 0 ? ["messenger"] : []),
      ] as Array<"all" | "whatsapp" | "instagram" | "messenger">,
    };
  });
