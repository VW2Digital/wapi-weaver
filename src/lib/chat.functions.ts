"use server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { sendInstagramMessage } from "@/lib/instagram-messenger";
import db from "./db";

type JsonValue = string | number | boolean | null | undefined | JsonRecord | JsonValue[];
interface JsonRecord {
  [key: string]: JsonValue;
}
type ChatMessageType = z.infer<typeof sendMessageInput>["type"] | "system";

interface ChatContactRow extends JsonRecord {
  id: string;
  user_id: string;
  phone_e164: string;
  custom_fields?: string | JsonRecord | null;
  channel?: string | null;
}

interface ChatContactListItem extends JsonRecord {
  id: string;
  user_id: string;
  phone_e164: string;
  custom_fields: JsonValue;
  channel?: string | null;
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
      filename: z.string().optional(),
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
  reply_to_message_id: z.string().optional(),
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
          SELECT user_id, contact_phone, body, created_at
          FROM (
            SELECT user_id, contact_phone, body, created_at,
                   ROW_NUMBER() OVER(PARTITION BY user_id, contact_phone ORDER BY created_at DESC) as rn
            FROM direct_messages
          ) tmp WHERE rn = 1
        ) last_dm ON last_dm.user_id = c.user_id AND last_dm.contact_phone = c.phone_e164
        LEFT JOIN (
          SELECT user_id, contact_phone, COUNT(*) as cnt
          FROM direct_messages
          WHERE direction = 'incoming' AND (status IS NULL OR status != 'read')
          GROUP BY user_id, contact_phone
        ) unread ON unread.user_id = c.user_id AND unread.contact_phone = c.phone_e164
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
        WHERE c.user_id = ?
          AND (
            last_dm.created_at IS NOT NULL
            OR last_cm.sent_at IS NOT NULL
            OR c.channel = 'whatsapp_group'
          )
        ORDER BY 
          c.is_pinned DESC,
          COALESCE(last_dm.created_at, last_cm.sent_at, c.created_at) DESC
      `,
        [effectiveUserId],
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

    await db.query(
      `UPDATE direct_messages SET status = 'read'
       WHERE user_id = ? AND contact_phone = ? AND direction = 'incoming' AND (status IS NULL OR status != 'read')`,
      [effectiveUserId, phone],
    );

    await db.query(`UPDATE contacts SET is_unread = false WHERE user_id = ? AND phone_e164 = ?`, [
      effectiveUserId,
      phone,
    ]);

    return { ok: true };
  });

export const getChatContactDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = normalizeChatContactId(data.phone);
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts = (await db.query(
      `SELECT * FROM contacts WHERE user_id = ? AND phone_e164 = ? LIMIT 1`,
      [effectiveUserId, phone],
    )) as ChatContactDetailsRow[];
    const contact = contacts?.[0] ?? null;

    if (contact) {
      const botStates = (await db.query(
        `SELECT bot_active FROM bot_conversation_state WHERE user_id = ? AND contact_number = ? AND channel = ? LIMIT 1`,
        [effectiveUserId, phone, contact.channel],
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

    const messages = (await db.query(
      `SELECT * FROM direct_messages
       WHERE user_id = ? AND contact_phone = ?
       ORDER BY created_at ASC`,
      [effectiveUserId, phone],
    )) as DirectMessageRow[];

    const assignments = (await db.query(
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
       ORDER BY ca.assigned_at ASC`,
      [effectiveUserId, phone],
    )) as AssignmentRow[];

    const campaignMessages = (await db.query(
      `SELECT cm.id, cm.status, cm.sent_at, cm.created_at, c.name AS campaign_name
       FROM campaign_messages cm
       LEFT JOIN campaigns c ON c.id = cm.campaign_id AND c.user_id = cm.user_id
       WHERE cm.user_id = ? AND cm.to_phone = ?
       ORDER BY COALESCE(cm.sent_at, cm.created_at) ASC`,
      [effectiveUserId, phone],
    )) as CampaignMessageRow[];

    const formattedMessages = (messages ?? []).map((row) => {
      const meta = asJsonRecord(row.metadata);
      const rawPayload = asJsonRecord(row.raw_payload);
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
      const contactsData = Array.isArray(meta?.contacts)
        ? meta.contacts
        : Array.isArray(metaMessage?.contacts)
          ? metaMessage.contacts
          : Array.isArray(rawMessage?.contacts)
            ? rawMessage.contacts
            : null;
      const reactionData =
        asJsonRecord(meta?.reaction) ||
        asJsonRecord(rawMessage?.reaction) ||
        (row.type === "reaction" ? { emoji: row.body, message_id: row.reply_to_message_id } : null);
      const messageType = row.type as ChatMessageType;
      return {
        id: row.id,
        wa_message_id: row.wa_message_id,
        provider_message_id: row.provider_message_id,
        direction: row.direction as "incoming" | "outgoing",
        timestamp: row.created_at,
        type: messageType,
        body: row.body,
        status: row.status,
        sender_name: row.sender_name || null,
        sender_wa_id: row.sender_wa_id || null,
        reaction: row.type === "reaction" ? reactionData : null,
        image: row.type === "image" ? imageData || { id: row.body } : null,
        audio: row.type === "audio" ? audioData || { id: row.body } : null,
        video: row.type === "video" ? videoData || { id: row.body } : null,
        document: row.type === "document" ? documentData || { id: row.body } : null,
        sticker: row.type === "sticker" ? stickerData || { id: row.body } : null,
        location: row.type === "location" ? locationData : null,
        contacts: row.type === "contacts" ? contactsData : null,
        context: row.reply_to_message_id ? { message_id: row.reply_to_message_id } : null,
        metadata: meta || rawPayload || null,
      };
    });

    const formattedAssignments = (assignments ?? []).map((a) => {
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

    const formattedCampaignMessages = (campaignMessages ?? []).map((m) => ({
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

    let wamid: string | null = null;
    let body: JsonRecord | null = null;
    let providerAccountId: string | null = null;

    if (isInstagram) {
      const igAccounts = (await db.query(
        `SELECT ig_user_id, access_token FROM instagram_accounts WHERE user_id = ? AND status = 'active' LIMIT 1`,
        [effectiveUserId],
      )) as InstagramAccountRow[];
      const account = igAccounts?.[0];

      if (!account) {
        return { ok: false, error: "Nenhuma conta profissional do Instagram conectada." };
      }

      const contacts = (await db.query(
        `SELECT external_contact_id FROM contacts WHERE user_id = ? AND phone_e164 = ? LIMIT 1`,
        [effectiveUserId, digits],
      )) as ExternalContactRow[];
      const externalId = contacts?.[0]?.external_contact_id;
      if (!externalId) {
        return { ok: false, error: "Contato do Instagram sem external_contact_id." };
      }

      const result = await sendInstagramMessage({
        igUserId: account.ig_user_id,
        accessToken: account.access_token,
        recipientId: externalId,
        data,
        replyToMessageId: data.reply_to_message_id,
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      wamid = result.wamid;
      body = asJsonRecord(result.body);
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
        `SELECT external_contact_id FROM contacts WHERE user_id = ? AND phone_e164 = ? LIMIT 1`,
        [effectiveUserId, digits],
      )) as ExternalContactRow[];
      const externalId = contacts?.[0]?.external_contact_id;
      if (!externalId) {
        return { ok: false, error: "Contato do Messenger sem external_contact_id." };
      }

      const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
      const payload: JsonRecord = {
        recipient: { id: externalId },
      };

      if (data.type === "text") {
        payload.message = { text: data.text?.body || "" };
      } else if (data.type === "reaction") {
        payload.sender_action = "react";
        payload.payload = {
          message_id: data.reaction?.message_id || "",
          reaction: data.reaction?.emoji || "",
        };
      } else if (["image", "audio", "video", "document"].includes(data.type)) {
        const attachmentType =
          data.type === "document" ? "file" : (data.type as "image" | "audio" | "video");

        let mediaUrl = "";
        let attachmentId = "";

        if (data.type === "image") {
          mediaUrl = data.image?.link || "";
          attachmentId = data.image?.id || "";
        } else if (data.type === "audio") {
          mediaUrl = data.audio?.link || "";
          attachmentId = data.audio?.id || "";
        } else if (data.type === "video") {
          mediaUrl = data.video?.link || "";
          attachmentId = data.video?.id || "";
        } else if (data.type === "document") {
          mediaUrl = data.document?.link || "";
          attachmentId = data.document?.id || "";
        }

        payload.message = {
          attachment: {
            type: attachmentType,
            payload: attachmentId ? { attachment_id: attachmentId } : { url: mediaUrl },
          },
        };
      }

      const r = await fetch(`https://graph.facebook.com/${apiVersion}/${page.page_id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${page.page_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      body = asJsonRecord(await r.json());
      if (!r.ok) {
        return {
          ok: false,
          error:
            getStringValue(asJsonRecord(body?.error)?.message) ??
            "Falha ao enviar mensagem no Messenger.",
        };
      }

      providerAccountId = digits.startsWith("fb_") ? digits.slice(3) : digits;
      wamid = getStringValue(body?.message_id);
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

      const payload: JsonRecord = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
      };

      if (data.reply_to_message_id) {
        payload.context = { message_id: data.reply_to_message_id };
      }

      if (data.type === "text") {
        payload.type = "text";
        payload.text = {
          body: data.text?.body || "",
          preview_url: data.text?.preview_url ?? false,
        };
      } else if (data.type === "reaction") {
        payload.type = "reaction";
        payload.reaction = {
          message_id: data.reaction?.message_id || "",
          emoji: data.reaction?.emoji || "",
        };
      } else if (data.type === "image") {
        payload.type = "image";
        payload.image = data.image?.id ? { id: data.image.id } : { link: data.image?.link };
      } else if (data.type === "audio") {
        payload.type = "audio";
        payload.audio = data.audio?.id ? { id: data.audio.id } : { link: data.audio?.link };
      } else if (data.type === "video") {
        payload.type = "video";
        payload.video = data.video?.id ? { id: data.video.id } : { link: data.video?.link };
      } else if (data.type === "document") {
        payload.type = "document";
        payload.document = data.document?.id
          ? { id: data.document.id, filename: data.document.filename }
          : { link: data.document?.link, filename: data.document?.filename };
      } else if (data.type === "sticker") {
        payload.type = "sticker";
        payload.sticker = data.sticker?.id ? { id: data.sticker.id } : { link: data.sticker?.link };
      } else if (data.type === "location") {
        payload.type = "location";
        payload.location = {
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          name: data.location?.name,
          address: data.location?.address,
        };
      } else if (data.type === "contacts") {
        payload.type = "contacts";
        payload.contacts = data.contacts;
      }

      const apiVersion = profile.meta_graph_version || "v20.0";
      const r = await fetch(
        `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${profile.whatsapp_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      body = asJsonRecord(await r.json());
      if (!r.ok) {
        return {
          ok: false,
          error:
            getStringValue(asJsonRecord(body?.error)?.message) ??
            "Falha ao enviar mensagem na Meta.",
        };
      }

      providerAccountId = profile.whatsapp_phone_number_id || null;
      wamid = normalizeWaMessageId(getStringValue(asJsonRecordArray(body?.messages)[0]?.id));
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
    const metadata = {
      text: data.text,
      reaction: data.reaction,
      image: data.image,
      audio: data.audio,
      video: data.video,
      document: data.document,
      sticker: data.sticker,
      location: data.location,
      contacts: data.contacts,
    };
    const msgId = crypto.randomUUID();
    await db.query(
      `INSERT INTO direct_messages (id, user_id, contact_phone, direction, type, body, wa_message_id, status, reply_to_message_id, metadata, channel, provider_account_id)
       VALUES (?, ?, ?, 'outgoing', ?, ?, ?, 'sent', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         body = VALUES(body),
         metadata = VALUES(metadata)`,
      [
        msgId,
        effectiveUserId,
        digits,
        data.type,
        bodyText,
        wamid,
        data.reply_to_message_id || null,
        JSON.stringify(metadata),
        isInstagram ? "instagram" : isMessenger ? "messenger" : "whatsapp",
        providerAccountId,
      ],
    );

    // 5. PAUSA O BOT (Fase 1 do BotFlow)
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const pausedUntil = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    await db.query(
      `UPDATE bot_conversation_state
       SET is_paused = true, paused_until = ?
       WHERE user_id = ? AND contact_number = ? AND channel = ?`,
      [
        pausedUntil,
        effectiveUserId,
        digits,
        isInstagram ? "instagram" : isMessenger ? "messenger" : "whatsapp",
      ],
    );

    return { ok: true, wamid, body };
  });
