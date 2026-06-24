import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
      // Usamos db.query para uma consulta SQL rica e eficiente contendo a última mensagem, timestamp e contagem de não lidas.
      const contacts = await db.query(`
        SELECT 
          c.id, 
          c.name, 
          c.phone_e164, 
          c.custom_fields,
          c.email,
          c.source,
          c.opted_out,
          c.created_at,
          c.updated_at,
          (
            SELECT dm.body 
            FROM direct_messages dm 
            WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
            ORDER BY dm.created_at DESC 
            LIMIT 1
          ) AS last_message_body,
          (
            SELECT dm.created_at 
            FROM direct_messages dm 
            WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
            ORDER BY dm.created_at DESC 
            LIMIT 1
          ) AS last_message_time,
          (
            SELECT COUNT(*) 
            FROM direct_messages dm 
            WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164 
              AND dm.direction = 'incoming' AND dm.status != 'read'
          ) AS unread_count
        FROM contacts c
        WHERE c.user_id = ?
        ORDER BY 
          COALESCE(
            (
              SELECT dm.created_at 
              FROM direct_messages dm 
              WHERE dm.user_id = c.user_id AND dm.contact_phone = c.phone_e164
              ORDER BY dm.created_at DESC 
              LIMIT 1
            ),
            c.created_at
          ) DESC
      `, [context.userId]);

      return (contacts ?? []).map((c: any) => ({
        ...c,
        // Garante que o custom_fields seja retornado como objeto parseado, se for string
        custom_fields: typeof c.custom_fields === 'string' ? JSON.parse(c.custom_fields) : c.custom_fields
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
    
    // Atualiza todas as mensagens recebidas não lidas deste contato para 'read'
    const { error } = await context.db
      .from("direct_messages")
      .update({ status: "read" })
      .eq("contact_phone", phone)
      .eq("direction", "incoming")
      .neq("status", "read");
      
    if (error) {
      console.error("Erro ao marcar mensagens como lidas:", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const getChatContactDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "");
    const { data: contact, error } = await context.db
      .from("contacts")
      .select("*")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return contact ?? null;
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "");

    // context.db auto-scopes by user_id — no need to add .eq("user_id", ...) manually
    const { data: messages, error } = await context.db
      .from("direct_messages")
      .select("*")
      .eq("contact_phone", phone)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

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
      };
    });
  });

export const sendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => sendMessageInput.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Busca credenciais do perfil (scoped to the authenticated user)
    const { data: p, error: profErr } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .maybeSingle();

    if (profErr || !p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais de API não configuradas em Configurações." };
    }

    const digits = data.to.replace(/\D/g, "");
    if (digits.length < 8) return { ok: false, error: "Número do destinatário inválido." };

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

    // 4. Registra a mensagem enviada na tabela direct_messages
    // context.db is user-scoped: user_id is automatically filled in by the query compiler
    const { error: msgErr } = await context.db.from("direct_messages").upsert({
      contact_phone: digits,
      direction: "outgoing",
      type: data.type,
      body: bodyText,
      wa_message_id: wamid,
      status: "sent",
      reply_to_message_id: data.reply_to_message_id || null,
      metadata: {
        text: data.text,
        reaction: data.reaction,
        image: data.image,
        audio: data.audio,
        video: data.video,
        document: data.document,
        sticker: data.sticker,
        location: data.location,
        contacts: data.contacts,
      },
    });

    if (msgErr) throw new Error(msgErr.message);

    // 5. PAUSA O BOT (Fase 1 do BotFlow)
    // Quando um humano envia mensagem, o bot entra em pausa automática por padrão.
    // Vamos setar paused_until para +60 minutos (fallback genérico)
    const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await context.db
      .from("bot_conversation_state")
      .update({
        is_paused: true,
        paused_until: pausedUntil,
      })
      .eq("contact_number", digits)
      .eq("instance_id", p.whatsapp_phone_number_id);

    return { ok: true, wamid, body };
  });
