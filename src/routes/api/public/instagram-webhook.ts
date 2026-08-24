import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
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

        const { data: account } = await dbAdmin
          .from("instagram_accounts")
          .select("tenant_id, user_id, page_id, instagram_business_account_id, access_token")
          .or(`page_id.eq.${pageId},instagram_business_account_id.eq.${pageId}`)
          .maybeSingle();

        if (!account) {
          logError(`Nenhuma conta conectada localizada para page_id / ig_account_id: ${pageId}`);
          return new Response("Account not integrated", { status: 404 });
        }

        const appSecret = process.env.META_APP_SECRET;
        if (appSecret) {
          const verified = await verifySignature(rawBody, sig, appSecret);
          if (!verified) {
            logError("Signature validation failed");
            return new Response("Forbidden (Invalid Signature)", { status: 403 });
          }
        }

        // Idempotency: verify by message ID (mid)
        const firstMsg = payload?.entry?.[0]?.messaging?.[0]?.message;
        const mid = firstMsg?.mid || payload?.entry?.[0]?.messaging?.[0]?.reaction?.mid;
        
        if (mid) {
          const { data: existingDm } = await dbAdmin
            .from("direct_messages")
            .select("id")
            .eq("user_id", account.user_id)
            .eq("channel", "instagram")
            .eq("provider_message_id", mid)
            .maybeSingle();
          if (existingDm) {
            logInfo("Evento duplicado ignorado (mid já processado)", { mid });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
        }

        let eventType = "unknown";
        if (firstMsg) eventType = "message";
        else if (payload?.entry?.[0]?.messaging?.[0]?.reaction) eventType = "reaction";
        
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

                  const phonePlaceholder = `ig_${senderId}`;
                  const name = `Instagram (${item.sender?.name || senderId})`;

                  // Contato Upsert
                  const { data: contact } = await dbAdmin
                    .from("contacts")
                    .upsert(
                      {
                        user_id: account.user_id,
                        phone_e164: phonePlaceholder,
                        name: name,
                        channel: "instagram",
                        external_contact_id: senderId,
                        source: "instagram",
                      },
                      { onConflict: "user_id,channel,external_contact_id" },
                    )
                    .select("id")
                    .single();

                  if (item.message) {
                    const message = item.message;
                    
                    if (message.is_echo) {
                      // Process Echo (bot/agent sending message)
                      // Could update outbox, but normally handled differently. Ignore for now.
                      continue; 
                    }

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
                    
                    // Mark as seen automatically (optional based on setting, but good practice for bot)
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
