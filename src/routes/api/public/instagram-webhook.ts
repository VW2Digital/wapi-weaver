import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { processBotFlow } from "@/lib/botflow-executor.server";

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

        if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
          logInfo("GET validado com sucesso");
          return new Response(challenge ?? "", { status: 200 });
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

        // Resolvendo a conta vinculada e o usuário proprietário
        const pageId = payload?.entry?.[0]?.id;
        if (!pageId) {
          logError("Meta page ID not found in payload");
          return new Response("Page ID missing", { status: 400 });
        }

        const { data: account } = await dbAdmin
          .from("instagram_accounts")
          .select("user_id, status")
          .eq("ig_user_id", pageId)
          .maybeSingle();

        if (!account) {
          logError(`Nenhuma conta conectada localizada para ig_user_id: ${pageId}`);
          return new Response("Account not integrated", { status: 404 });
        }

        // Validando assinatura Meta se META_APP_SECRET existir
        const appSecret = process.env.META_APP_SECRET;
        if (appSecret) {
          const verified = await verifySignature(rawBody, sig, appSecret);
          if (!verified) {
            logError("Signature validation failed");
            return new Response("Forbidden (Invalid Signature)", { status: 403 });
          }
        }

        // Idempotência: verificar duplicata pelo campo message.mid
        const firstMsg = payload?.entry?.[0]?.messaging?.[0]?.message;
        if (firstMsg?.mid) {
          const { data: existingDm } = await dbAdmin
            .from("direct_messages")
            .select("id")
            .eq("user_id", account.user_id)
            .eq("channel", "instagram")
            .eq("provider_message_id", firstMsg.mid)
            .maybeSingle();
          if (existingDm) {
            logInfo("Evento duplicado ignorado (mid já processado)", { mid: firstMsg.mid });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
        }

        // Salvar evento no banco para auditoria
        const { data: eventRow } = await dbAdmin
          .from("instagram_webhook_events")
          .insert({
            user_id: account.user_id,
            raw: payload,
            processed: false,
          })
          .select("id")
          .single();

        // Processamento assíncrono para responder rapidamente à Meta
        setTimeout(() => {
          (async () => {
            try {
              for (const entry of payload.entry ?? []) {
                for (const item of entry.messaging ?? []) {
                  const senderId = item.sender?.id;
                  const recipientId = item.recipient?.id;
                  const message = item.message;

                  if (senderId && message && message.text) {
                    const phonePlaceholder = `ig_${senderId}`;
                    const name = `Instagram (${item.sender?.name || senderId})`;

                    // 1. Criar ou atualizar contato
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
                        { onConflict: "user_id,channel,external_contact_id" }
                      )
                      .select("id")
                      .single();

                    const contactId = contact?.id;

                    // 2. Salvar mensagem recebida (com dedup via unique key)
                    await dbAdmin.from("direct_messages").upsert(
                      {
                        user_id: account.user_id,
                        contact_phone: phonePlaceholder,
                        direction: "incoming",
                        type: "text",
                        body: message.text,
                        channel: "instagram",
                        provider_message_id: message.mid,
                        provider_account_id: recipientId,
                        status: "delivered",
                        metadata: { raw: item },
                      },
                      { onConflict: "user_id,channel,provider_message_id" }
                    );

                    // 3. Chamar executor do Bot
                    await processBotFlow(
                      message.text,
                      phonePlaceholder,
                      recipientId,
                      account.user_id,
                      undefined,
                      "instagram",
                    );
                  }
                }
              }

              if (eventRow?.id) {
                await dbAdmin
                  .from("instagram_webhook_events")
                  .update({ processed: true })
                  .eq("id", eventRow.id);
              }
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
