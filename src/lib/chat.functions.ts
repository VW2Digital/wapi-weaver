import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Schema de validação para envio de mensagem direta
const sendMessageInput = z.object({
  to: z.string().trim().min(8).max(20),
  type: z.enum(["text", "reaction", "image"]),
  text: z.object({
    body: z.string(),
    preview_url: z.boolean().default(false),
  }).optional(),
  reaction: z.object({
    message_id: z.string(),
    emoji: z.string(),
  }).optional(),
  image: z.object({
    id: z.string(),
  }).optional(),
  reply_to_message_id: z.string().optional(),
});

export const listChatContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: contacts, error } = await supabaseAdmin
      .from("contacts")
      .select("id, name, phone_e164")
      .eq("user_id", context.userId)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return contacts ?? [];
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "");

    const { data: messages, error } = await supabaseAdmin
      .from("direct_messages")
      .select("*")
      .eq("user_id", context.userId)
      .eq("contact_phone", phone)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (messages ?? []).map((row: any) => {
      const meta = row.metadata as any;
      return {
        id: row.wa_message_id || row.id,
        direction: row.direction as "incoming" | "outgoing",
        timestamp: row.created_at,
        type: row.type as "text" | "reaction" | "image",
        body: row.body,
        status: row.status,
        reaction: row.type === "reaction" ? (meta?.reaction || { emoji: row.body, message_id: row.reply_to_message_id }) : null,
        image: row.type === "image" ? (meta?.image || { id: row.body }) : null,
        context: row.reply_to_message_id ? { message_id: row.reply_to_message_id } : null,
      };
    });
  });

export const sendDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendMessageInput.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Busca credenciais do perfil
    const { data: p, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
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
      payload.image = {
        id: data.image?.id || "",
      };
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
      }
    );

    const body = await r.json();
    if (!r.ok) {
      return { ok: false, error: body?.error?.message ?? "Falha ao enviar mensagem na Meta." };
    }

    const wamid = body?.messages?.[0]?.id || null;

    let bodyText = "";
    if (data.type === "text") {
      bodyText = data.text?.body || "";
    } else if (data.type === "reaction") {
      bodyText = data.reaction?.emoji || "";
    } else if (data.type === "image") {
      bodyText = data.image?.id || "";
    }

    // 4. Registra a mensagem enviada na tabela direct_messages
    const { error: msgErr } = await supabaseAdmin
      .from("direct_messages")
      .insert({
        user_id: context.userId,
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
        },
      });

    if (msgErr) throw new Error(msgErr.message);

    return { ok: true, wamid, body };
  });
