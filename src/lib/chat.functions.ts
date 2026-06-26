import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import db from "./db";

// Schema de validação para envio de mensagem direta
const sendMessageInput = z.object({
  to: z.string().trim().min(8).max(20),
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
      const contacts = await db.query(
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
          ON bcs.user_id = c.user_id AND bcs.contact_number = c.phone_e164
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
          WHERE direction = 'incoming' AND status != 'read'
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
          AND (last_dm.created_at IS NOT NULL OR last_cm.sent_at IS NOT NULL)
        ORDER BY 
          c.is_pinned DESC,
          COALESCE(last_dm.created_at, last_cm.sent_at, c.created_at) DESC
      `,
        [effectiveUserId],
      );

      return (contacts ?? []).map((c: any) => ({
        ...c,
        custom_fields:
          typeof c.custom_fields === "string" ? JSON.parse(c.custom_fields) : c.custom_fields,
      }));
    } catch (e: any) {
      console.error("Erro ao listar contatos com mensagens:", e);
      throw new Error(e.message || "Erro ao consultar contatos");
    }
  });

export const markMessagesAsRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    await db.query(
      `UPDATE direct_messages SET status = 'read'
       WHERE user_id = ? AND contact_phone = ? AND direction = 'incoming' AND (status IS NULL OR status != 'read')`,
      [effectiveUserId, phone],
    );

    await db.query(
      `UPDATE contacts SET is_unread = false WHERE user_id = ? AND phone_e164 = ?`,
      [effectiveUserId, phone],
    );

    return { ok: true };
  });

export const getChatContactDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const contacts: any[] = (await db.query(
      `SELECT * FROM contacts WHERE user_id = ? AND phone_e164 = ? LIMIT 1`,
      [effectiveUserId, phone],
    )) as any[];
    const contact = contacts?.[0] ?? null;

    if (contact) {
      const botStates: any[] = (await db.query(
        `SELECT bot_active FROM bot_conversation_state WHERE user_id = ? AND contact_number = ? LIMIT 1`,
        [effectiveUserId, phone],
      )) as any[];
      contact.bot_active = botStates?.[0] ? !!botStates[0].bot_active : true;
    }

    return contact ?? null;
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const messages: any[] = (await db.query(
      `SELECT * FROM direct_messages
       WHERE user_id = ? AND contact_phone = ?
       ORDER BY created_at ASC`,
      [effectiveUserId, phone],
    )) as any[];

    return (messages ?? []).map((row: any) => {
      const meta = row.metadata as any;
      return {
        id: row.wa_message_id || row.id,
        direction: row.direction as "incoming" | "outgoing",
        timestamp: row.created_at,
        type: row.type as any,
        body: row.body,
        status: row.status,
        reaction:
          row.type === "reaction"
            ? meta?.reaction || { emoji: row.body, message_id: row.reply_to_message_id }
            : null,
        image: row.type === "image" ? meta?.image || { id: row.body } : null,
        audio: row.type === "audio" ? meta?.audio || { id: row.body } : null,
        video: row.type === "video" ? meta?.video || { id: row.body } : null,
        document: row.type === "document" ? meta?.document || { id: row.body } : null,
        sticker: row.type === "sticker" ? meta?.sticker || { id: row.body } : null,
        location:
          row.type === "location" ? meta?.location || meta?.message?.location || null : null,
        contacts:
          row.type === "contacts" ? meta?.contacts || meta?.message?.contacts || null : null,
        context: row.reply_to_message_id ? { message_id: row.reply_to_message_id } : null,
        metadata: meta,
      };
    });
  });

export const sendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => sendMessageInput.parse(d))
  .handler(async ({ data, context }) => {
    const digits = data.to.replace(/\D/g, "");
    if (digits.length < 8) return { ok: false, error: "Número do destinatário inválido." };

    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    // Busca credenciais do perfil do dono do WhatsApp
    const profiles: any[] = (await db.query(
      `SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version
       FROM profiles WHERE id = ? LIMIT 1`,
      [effectiveUserId],
    )) as any[];
    const p = profiles?.[0];

    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais de API não configuradas em Configurações." };
    }

    // 2. Reconstrói o payload de envio conforme especificações do cURL
    const payload: any = {
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

    // 3. Envia para a API da Meta
    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = await r.json();
    if (!r.ok) {
      return { ok: false, error: body?.error?.message ?? "Falha ao enviar mensagem na Meta." };
    }

    const wamid = normalizeWaMessageId(body?.messages?.[0]?.id);

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
      `INSERT INTO direct_messages (id, user_id, contact_phone, direction, type, body, wa_message_id, status, reply_to_message_id, metadata)
       VALUES (?, ?, ?, 'outgoing', ?, ?, ?, 'sent', ?, ?)
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
      ],
    );

    // 5. PAUSA O BOT (Fase 1 do BotFlow)
    // Quando um humano envia mensagem, o bot entra em pausa automática por padrão.
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const pausedUntil = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    await db.query(
      `UPDATE bot_conversation_state
       SET is_paused = true, paused_until = ?
       WHERE user_id = ? AND contact_number = ? AND instance_id = ?`,
      [pausedUntil, effectiveUserId, digits, p.whatsapp_phone_number_id],
    );

    return { ok: true, wamid, body };
  });
