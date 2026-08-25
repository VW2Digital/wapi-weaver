import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import db from "@/lib/db";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { processBotFlow } from "@/lib/botflow-executor.server";
import { publishChatRealtimeEvent } from "@/lib/chat-realtime.server";
import { markInstagramMessageSeen } from "@/lib/instagram.functions";
import { resolveInstagramRecordOwnership } from "@/lib/instagram-webhook-owner";

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

        logInfo("POST recebido", { hasSignature: !!sig, bytes: rawBody.length });

        let payload: any = null;
        try {
          payload = JSON.parse(rawBody);
          logInfo("Payload parsed successfully", { entryCount: payload?.entry?.length });
        } catch (e: any) {
          logError("JSON parsing failed", e.message);
          return new Response("Bad Request", { status: 400 });
        }

        const pageId = payload?.entry?.[0]?.id;
        if (!pageId) {
          logError("Meta page ID not found in payload", { payload });
          return new Response("Page ID missing", { status: 400 });
        }

        logInfo("Looking for Instagram account", { pageId });

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
        logInfo("Account lookup result", { found: !!account, accountsCount: accounts?.length });

        if (!account) {
          // Fallback if there is an active instagram account
          logInfo("Trying fallback to active Instagram account");
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

        // tenant_id controla o isolamento da empresa; user_id mantém a autoria
        // da conta conectada. O chat consulta pelo tenant e relaciona contato e
        // mensagens pelo mesmo user_id, portanto os campos não são intercambiáveis.
        const { tenantId, userId: accountUserId } = resolveInstagramRecordOwnership(account);

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
            .eq("user_id", accountUserId)
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
          
        if (eventInsertError && eventInsertError.code !== '23505') {
          logError("Falha ao registrar evento do Instagram", eventInsertError);
        }

        try {
          for (const entry of payload.entry ?? []) {
            for (const item of entry.messaging ?? []) {
              const itemSenderId = item.sender?.id;
              const itemRecipientId = item.recipient?.id;
              
              if (!itemSenderId) continue;

              // Tratar Echo (mensagens enviadas pelo próprio perfil/bot para o cliente)
              if (item.message?.is_echo) {
                const clientContactId = itemRecipientId;
                const phonePlaceholder = `ig_${clientContactId}`;

                const { error: echoContactError } = await dbAdmin
                  .from("contacts")
                  .upsert(
                    {
                      tenant_id: tenantId,
                      user_id: accountUserId,
                      phone_e164: phonePlaceholder,
                      name: `Instagram (${clientContactId})`,
                      channel: "instagram",
                      external_contact_id: clientContactId,
                      source: "instagram",
                    },
                    { onConflict: "user_id,channel,external_contact_id" },
                  );
                if (echoContactError) {
                  throw new Error(`Falha ao persistir contato do echo: ${echoContactError.message}`);
                }

                const { data: storedEcho, error: storedEchoError } = await dbAdmin.from("direct_messages").upsert(
                  {
                    tenant_id: tenantId,
                    user_id: accountUserId,
                    contact_phone: phonePlaceholder,
                    direction: "outgoing",
                    type: "text",
                    body: item.message.text || "",
                    channel: "instagram",
                    provider_message_id: item.message.mid,
                    wa_message_id: item.message.mid,
                    provider_account_id: itemSenderId,
                    status: "delivered",
                    metadata: { raw: item },
                  },
                  { onConflict: "user_id,channel,provider_message_id" },
                ).select("id").single();
                if (storedEchoError || !storedEcho?.id) {
                  throw new Error(
                    `Falha ao persistir echo do Instagram: ${storedEchoError?.message || "ID não retornado"}`,
                  );
                }

                await publishChatRealtimeEvent({
                  type: "message.sent",
                  tenant_id: tenantId,
                  contact_phone: phonePlaceholder,
                  message_id: storedEcho?.id || null,
                  provider_message_id: item.message.mid || null,
                  status: "delivered",
                });
                continue;
              }

              const phonePlaceholder = `ig_${itemSenderId}`;

              // Tenta enriquecer contato com dados reais do perfil do Instagram via Graph API
              let contactName = item.sender?.name || `Instagram (${itemSenderId})`;
              let contactAvatarUrl: string | undefined = undefined;

              if (account.access_token) {
                try {
                  const { fetchInstagramUserProfile } = await import("@/lib/instagram.functions");
                  const userProfile = await fetchInstagramUserProfile(itemSenderId, account.access_token);
                  if (userProfile?.name) contactName = userProfile.name;
                  if (userProfile?.profilePic) contactAvatarUrl = userProfile.profilePic;
                } catch {
                  // Fallback silencioso mantendo nome padrão
                }
              }

              // Contato Upsert
              const contactCustomFields: Record<string, any> = {};
              if (contactAvatarUrl) {
                contactCustomFields.avatar_url = contactAvatarUrl;
              }

              const { error: contactUpsertError } = await dbAdmin
                .from("contacts")
                .upsert(
                  {
                    tenant_id: tenantId,
                    user_id: accountUserId,
                    phone_e164: phonePlaceholder,
                    name: contactName,
                    channel: "instagram",
                    external_contact_id: itemSenderId,
                    source: "instagram",
                    is_unread: true,
                    custom_fields: Object.keys(contactCustomFields).length > 0 ? contactCustomFields : undefined,
                  },
                  { onConflict: "user_id,channel,external_contact_id" },
                );
              if (contactUpsertError) {
                throw new Error(`Falha ao persistir contato do Instagram: ${contactUpsertError.message}`);
              }

              if (item.message) {
                const message = item.message;
                logInfo("[INSTAGRAM] Processando mensagem recebida", { 
                  mid: message.mid, 
                  senderId: itemSenderId,
                  type: message.attachments?.[0]?.type || (message.sticker ? 'sticker' : 'text')
                });

                let messageType = "text";
                let messageBody = message.text || "";
                let remoteMediaUrl = "";
                let attachmentMetadata: any = null;

                if (message.attachments && message.attachments.length > 0) {
                  const attachment = message.attachments[0];
                  messageType = attachment.type;
                  remoteMediaUrl = attachment.payload?.url || "";
                  attachmentMetadata = {
                    url: remoteMediaUrl,
                    id: attachment.payload?.sticker_id || attachment.payload?.attachment_id,
                  };
                  if (messageType === 'fallback') messageType = 'document';
                  if (messageType === 'animated_image_share' || messageType === 'share' || messageType === 'ig_reel') {
                    if (remoteMediaUrl) {
                      messageType = 'video';
                    }
                  }
                } else if (message.sticker) {
                  messageType = "sticker";
                  remoteMediaUrl = message.sticker.url || "";
                  attachmentMetadata = {
                    url: remoteMediaUrl,
                    id: message.sticker.id,
                  };
                }

                if (message.reply_to?.story) {
                  messageType = "text";
                  messageBody = message.text ? `${message.text}\n\n(Respondendo ao Story)` : "(Respondeu ao Story)";
                }
                
                if (message.quick_reply) {
                  messageBody = message.quick_reply.payload || message.text;
                }

                logInfo("[INSTAGRAM] Inserindo mensagem no banco", { 
                  phonePlaceholder, 
                  messageType, 
                  bodyLength: messageBody?.length 
                });

                const { data: storedMessage, error: storedMessageError } = await dbAdmin.from("direct_messages").upsert(
                  {
                    tenant_id: tenantId,
                    user_id: accountUserId,
                    contact_phone: phonePlaceholder,
                    direction: "incoming",
                    type: messageType,
                    body: messageBody,
                    channel: "instagram",
                    provider_message_id: message.mid,
                    wa_message_id: message.mid,
                    provider_account_id: itemRecipientId,
                    status: "delivered",
                    metadata: { 
                       raw: item, 
                       [messageType]: attachmentMetadata,
                       media_url: remoteMediaUrl || undefined,
                    },
                  },
                  { onConflict: "user_id,channel,provider_message_id" },
                ).select("id").single();
                if (storedMessageError || !storedMessage?.id) {
                  throw new Error(
                    `Falha ao persistir mensagem do Instagram: ${storedMessageError?.message || "ID não retornado"}`,
                  );
                }

                // Download da mídia para o storage próprio para garantir que não expire
                if (remoteMediaUrl && ["image", "audio", "video", "document", "sticker"].includes(messageType)) {
                  const { downloadAndPersistInstagramMedia } = await import("@/lib/instagram-media-downloader");
                  await downloadAndPersistInstagramMedia(
                    tenantId,
                    storedMessage.id,
                    messageType as any,
                    remoteMediaUrl,
                  );
                }

                logInfo("[INSTAGRAM] Mensagem inserida com sucesso", { 
                  messageId: storedMessage?.id, 
                  mid: message.mid 
                });

                await publishChatRealtimeEvent({
                  type: "message.received",
                  tenant_id: tenantId,
                  contact_phone: phonePlaceholder,
                  message_id: storedMessage?.id || null,
                  provider_message_id: message.mid || null,
                  status: "delivered",
                });
                
                logInfo("[INSTAGRAM] Evento realtime publicado com sucesso");

                // Mark as seen automatically
                if (account.access_token) {
                  markInstagramMessageSeen(pageId, account.access_token, itemSenderId, message.mid).catch(() => {});
                }

                await processBotFlow(
                  messageBody,
                  phonePlaceholder,
                  itemRecipientId,
                  tenantId,
                  undefined,
                  "instagram",
                );
              } else if (item.postback) {
                const postback = item.postback;
                const messageBody = postback.payload || postback.title;
                
                logInfo("[INSTAGRAM] Processando postback", { payload: postback.payload });
                
                const { data: storedMessage, error: storedMessageError } = await dbAdmin.from("direct_messages").upsert(
                  {
                    tenant_id: tenantId,
                    user_id: accountUserId,
                    contact_phone: phonePlaceholder,
                    direction: "incoming",
                    type: "text",
                    body: messageBody,
                    channel: "instagram",
                    provider_message_id: postback.mid || `postback_${Date.now()}`,
                    wa_message_id: postback.mid || `postback_${Date.now()}`,
                    provider_account_id: itemRecipientId,
                    status: "delivered",
                    metadata: { raw: item },
                  },
                  { onConflict: "user_id,channel,provider_message_id" },
                ).select("id").single();
                if (storedMessageError || !storedMessage?.id) {
                  throw new Error(
                    `Falha ao persistir postback do Instagram: ${storedMessageError?.message || "ID não retornado"}`,
                  );
                }

                await publishChatRealtimeEvent({
                  type: "message.received",
                  tenant_id: tenantId,
                  contact_phone: phonePlaceholder,
                  message_id: storedMessage?.id || null,
                  provider_message_id: postback.mid || null,
                  status: "delivered",
                });
              } else if (item.reaction) {
                const reaction = item.reaction;
                logInfo("[INSTAGRAM] Processando reação", { emoji: reaction.emoji });
                
                const { data: storedMessage, error: storedMessageError } = await dbAdmin.from("direct_messages").upsert(
                  {
                    tenant_id: tenantId,
                    user_id: accountUserId,
                    contact_phone: phonePlaceholder,
                    direction: "incoming",
                    type: "reaction",
                    body: reaction.emoji || "❤️",
                    channel: "instagram",
                    provider_message_id: reaction.mid || `react_${Date.now()}`,
                    wa_message_id: reaction.mid || `react_${Date.now()}`,
                    provider_account_id: itemRecipientId,
                    status: "delivered",
                    metadata: { raw: item, reaction: { action: reaction.action, emoji: reaction.emoji, mid: reaction.mid } },
                  },
                  { onConflict: "user_id,channel,provider_message_id" },
                ).select("id").single();
                if (storedMessageError || !storedMessage?.id) {
                  throw new Error(
                    `Falha ao persistir reação do Instagram: ${storedMessageError?.message || "ID não retornado"}`,
                  );
                }
                
                await publishChatRealtimeEvent({
                  type: "message.received",
                  tenant_id: tenantId,
                  contact_phone: phonePlaceholder,
                  message_id: storedMessage?.id || null,
                  provider_message_id: reaction.mid || null,
                  status: "delivered",
                });
              }
            }
          }

          if (eventRow?.id) {
            await dbAdmin
              .from("instagram_webhook_events")
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq("id", eventRow.id);
          }
          
          logInfo("Webhook processado com sucesso");
        } catch (err: any) {
          logError("Falha ao processar webhook", err.message);
          if (eventRow?.id) {
            await dbAdmin
              .from("instagram_webhook_events")
              .update({ error_message: err.message || "Falha desconhecida" })
              .eq("id", eventRow.id);
          }
          // Solicita reentrega à Meta. Os upserts por provider_message_id
          // tornam o reprocessamento idempotente.
          return new Response("Instagram webhook processing failed", { status: 500 });
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
