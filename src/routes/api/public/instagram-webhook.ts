import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import db from "@/lib/db";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { processBotFlow } from "@/lib/botflow-executor.server";
import { publishChatRealtimeEvent } from "@/lib/chat-realtime.server";
import { markInstagramMessageSeen } from "@/lib/instagram.functions";

function logInfo(message: string, data?: any) {
  console.log(`[instagram-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[instagram-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice(7);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/instagram-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        logInfo("GET recebido", { mode, token });

        if (mode === "subscribe" && token) {
          if (token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
            logInfo("GET validado via env var");
            return new Response(challenge ?? "", { status: 200 });
          }
          const { data: profile } = await dbAdmin
            .from("profiles")
            .select("id")
            .eq("whatsapp_verify_token", token)
            .maybeSingle();
          if (profile) {
            logInfo("GET validado via profile do usuário");
            return new Response(challenge ?? "", { status: 200 });
          }
        }

        logError("GET falhou na validação de token");
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
        } catch (e: any) {
          logError("JSON parsing failed", e.message);
          return new Response("Bad Request", { status: 400 });
        }

        const pageId = payload?.entry?.[0]?.id;
        if (!pageId) {
          logError("Meta page ID not found in payload");
          return new Response("Page ID missing", { status: 400 });
        }

        const accounts = (await db.query(
          `SELECT tenant_id, user_id, page_id, instagram_business_account_id, access_token
           FROM instagram_accounts
           WHERE page_id = ? OR instagram_business_account_id = ? OR ig_user_id = ?
           LIMIT 1`,
          [pageId, pageId, pageId],
        )) as Array<{
          tenant_id: string;
          user_id: string;
          page_id: string;
          instagram_business_account_id: string;
          access_token: string;
        }>;

        let account = accounts?.[0] ?? null;

        if (!account) {
          // Fallback if there is an active instagram account
          const fallback = (await db.query(
            `SELECT tenant_id, user_id, page_id, instagram_business_account_id, access_token
             FROM instagram_accounts
             WHERE is_active = 1
             LIMIT 1`,
          )) as Array<{
            tenant_id: string;
            user_id: string;
            page_id: string;
            instagram_business_account_id: string;
            access_token: string;
          }>;
          if (fallback?.[0]) {
            account = fallback[0];
          }
        }

        if (!account) {
          logError(`Nenhuma conta conectada localizada para page_id / ig_account_id: ${pageId}`);
          return new Response("Account not integrated", { status: 404 });
        }

        const envSecret = String(process.env.META_APP_SECRET ?? "").trim();
        if (sig && envSecret) {
          const verified = await verifySignature(rawBody, sig, envSecret);
          if (!verified) {
            logError("Signature validation failed for provided x-hub-signature-256");
            return new Response("Forbidden (Invalid Signature)", { status: 403 });
          }
        }

        // Idempotency: verify by message ID (mid)
        const firstMsg = payload?.entry?.[0]?.messaging?.[0]?.message;
        const mid = firstMsg?.mid || payload?.entry?.[0]?.messaging?.[0]?.reaction?.mid || payload?.entry?.[0]?.messaging?.[0]?.message_edit?.mid;
        
        if (mid) {
          const { data: existingDm } = await dbAdmin
            .from("direct_messages")
            .select("id")
            .eq("user_id", account.user_id)
            .eq("channel", "instagram")
            .eq("provider_message_id", mid)
            .maybeSingle();
          if (existingDm && !payload?.entry?.[0]?.messaging?.[0]?.message_edit) {
            logInfo("Evento duplicado ignorado (mid já processado)", { mid });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
        }

        let eventType = "unknown";
        if (firstMsg) eventType = "message";
        else if (payload?.entry?.[0]?.messaging?.[0]?.reaction) eventType = "reaction";
        else if (payload?.entry?.[0]?.messaging?.[0]?.message_edit) eventType = "message_edit";
        
        const senderId = payload?.entry?.[0]?.messaging?.[0]?.sender?.id;
        const recipientId = payload?.entry?.[0]?.messaging?.[0]?.recipient?.id;

        const { data: eventRow, error: eventInsertError } = await dbAdmin
          .from("instagram_webhook_events")
          .insert({
            tenant_id: account.tenant_id,
            page_id: account.page_id,
            instagram_business_account_id: account.instagram_business_account_id,
            event_type: eventType,
            message_mid: mid || null,
            sender_id: senderId || null,
            recipient_id: recipientId || null,
            payload: payload,
            processed: false,
          })
          .select("id")
          .single();
          
        if (eventInsertError && eventInsertError.code !== '23505') { // ignore duplicate mid error (unique constraint)
          logError("Falha ao registrar evento do Instagram", eventInsertError);
        }

        setTimeout(() => {
          (async () => {
            try {
              for (const entry of payload.entry ?? []) {
                for (const item of entry.messaging ?? []) {
                  const senderId = item.sender?.id;
                  const recipientId = item.recipient?.id;
                  
                  if (!senderId) continue;

                  // Tratar Echo (mensagens enviadas pelo próprio perfil/bot para o cliente)
                  if (item.message?.is_echo) {
                    const clientContactId = recipientId;
                    const phonePlaceholder = `ig_${clientContactId}`;

                    await dbAdmin
                      .from("contacts")
                      .upsert(
                        {
                          tenant_id: account.tenant_id || account.user_id,
                          user_id: account.user_id,
                          phone_e164: phonePlaceholder,
                          name: `Instagram (${clientContactId})`,
                          channel: "instagram",
                          external_contact_id: clientContactId,
                          source: "instagram",
                        },
                        { onConflict: "user_id,channel,external_contact_id" },
                      );

                    const { data: storedEcho } = await dbAdmin.from("direct_messages").upsert(
                      {
                        tenant_id: account.tenant_id || account.user_id,
                        user_id: account.user_id,
                        contact_phone: phonePlaceholder,
                        direction: "outgoing",
                        type: "text",
                        body: item.message.text || "",
                        channel: "instagram",
                        provider_message_id: item.message.mid,
                        wa_message_id: item.message.mid,
                        provider_account_id: senderId,
                        status: "delivered",
                        metadata: { raw: item },
                      },
                      { onConflict: "user_id,channel,provider_message_id" },
                    ).select("id").single();

                    await publishChatRealtimeEvent({
                      type: "message.sent",
                      tenant_id: account.user_id,
                      contact_phone: phonePlaceholder,
                      message_id: storedEcho?.id || null,
                      provider_message_id: item.message.mid || null,
                      status: "delivered",
                    });
                    continue;
                  }

                  const phonePlaceholder = `ig_${senderId}`;
                  const name = `Instagram (${item.sender?.name || senderId})`;

                  // Contato Upsert
                  const { data: contact } = await dbAdmin
                    .from("contacts")
                    .upsert(
                      {
                        tenant_id: account.tenant_id || account.user_id,
                        user_id: account.user_id,
                        phone_e164: phonePlaceholder,
                        name: name,
                        channel: "instagram",
                        external_contact_id: senderId,
                        source: "instagram",
                        is_unread: true,
                      },
                      { onConflict: "user_id,channel,external_contact_id" },
                    )
                    .select("id")
                    .single();

                  if (item.message) {
                    const message = item.message;

                    let messageType = "text";
                    let messageBody = message.text || "";
                    let attachmentMetadata: any = null;

                    if (message.attachments && message.attachments.length > 0) {
                      const attachment = message.attachments[0];
                      messageType = attachment.type; // image, video, audio, file
                      attachmentMetadata = {
                        url: attachment.payload?.url,
                        id: attachment.payload?.sticker_id || attachment.payload?.attachment_id,
                      };
                      if (messageType === 'fallback') messageType = 'document';
                    }

                    if (message.reply_to?.story) {
                      messageType = "text";
                      messageBody = message.text ? `${message.text}\n\n(Respondendo ao Story)` : "(Respondeu ao Story)";
                    }
                    
                    if (message.quick_reply) {
                      messageBody = message.quick_reply.payload || message.text;
                    }

                    const { data: storedMessage } = await dbAdmin.from("direct_messages").upsert(
                      {
                        tenant_id: account.user_id,
                        user_id: account.user_id,
                        contact_phone: phonePlaceholder,
                        direction: "incoming",
                        type: messageType,
                        body: messageBody,
                        channel: "instagram",
                        provider_message_id: message.mid,
                        wa_message_id: message.mid,
                        provider_account_id: recipientId,
                        status: "delivered",
                        metadata: { 
                           raw: item, 
                           [messageType]: attachmentMetadata
                        },
                      },
                      { onConflict: "user_id,channel,provider_message_id" },
                    ).select("id").single();

                    await publishChatRealtimeEvent({
                      type: "message.received",
                      tenant_id: account.user_id,
                      contact_phone: phonePlaceholder,
                      message_id: storedMessage?.id || null,
                      provider_message_id: message.mid || null,
                      status: "delivered",
                    });
                    
                    // Mark as seen automatically
                    await markInstagramMessageSeen(pageId, account.access_token, senderId, message.mid);

                    await processBotFlow(
                      messageBody,
                      phonePlaceholder,
                      recipientId,
                      account.user_id,
                      undefined,
                      "instagram",
                    );
                  } else if (item.postback) {
                    // Tratar Postbacks (botões)
                    const postback = item.postback;
                    const messageBody = postback.payload || postback.title;
                    
                    const { data: storedMessage } = await dbAdmin.from("direct_messages").upsert(
                      {
                        tenant_id: account.user_id,
                        user_id: account.user_id,
                        contact_phone: phonePlaceholder,
                        direction: "incoming",
                        type: "text",
                        body: messageBody,
                        channel: "instagram",
                        provider_message_id: postback.mid || crypto.randomUUID(),
                        provider_account_id: recipientId,
                        status: "delivered",
                        metadata: { raw: item },
                      },
                      { onConflict: "user_id,channel,provider_message_id" },
                    ).select("id").single();

                    await publishChatRealtimeEvent({
                      type: "message.received",
                      tenant_id: account.user_id,
                      contact_phone: phonePlaceholder,
                      message_id: storedMessage?.id || null,
                      provider_message_id: postback.mid || null,
                      status: "delivered",
                    });

                    await processBotFlow(
                      messageBody,
                      phonePlaceholder,
                      recipientId,
                      account.user_id,
                      undefined,
                      "instagram",
                    );
                  } else if (item.reaction) {
                    // Tratar Reactions
                    const reaction = item.reaction;
                    const { data: storedMessage } = await dbAdmin.from("direct_messages").upsert(
                      {
                        tenant_id: account.user_id,
                        user_id: account.user_id,
                        contact_phone: phonePlaceholder,
                        direction: "incoming",
                        type: "reaction",
                        body: reaction.emoji,
                        channel: "instagram",
                        provider_message_id: reaction.mid,
                        provider_account_id: recipientId,
                        status: "delivered",
                        metadata: { raw: item, reaction: { action: reaction.action, emoji: reaction.emoji, mid: reaction.mid } },
                      },
                      { onConflict: "user_id,channel,provider_message_id" },
                    ).select("id").single();
                    
                    await publishChatRealtimeEvent({
                      type: "message.received",
                      tenant_id: account.user_id,
                      contact_phone: phonePlaceholder,
                      message_id: storedMessage?.id || null,
                      provider_message_id: reaction.mid || null,
                      status: "delivered",
                    });
                  }
                }
              }

              const { error: updErr } = await dbAdmin
                .from("instagram_webhook_events")
                .update({ processed: true, processed_at: new Date().toISOString() })
                .eq("id", eventRow?.id);
              
              logInfo("Webhook processado com sucesso");
            } catch (err: any) {
              logError("Falha ao processar webhook", err.message);
            }
          })();
        }, 0);

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
