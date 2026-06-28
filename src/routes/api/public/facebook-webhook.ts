import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { processBotFlow } from "@/lib/botflow-executor.server";

function logInfo(message: string, data?: any) {
  console.log(`[facebook-webhook] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[facebook-webhook] ${message}`, data ? JSON.stringify(data) : "");
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

export const Route = createFileRoute("/api/public/facebook-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        logInfo("GET recebido", { mode, token });

        const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

        if (mode === "subscribe" && token === verifyToken) {
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

        // Resolvendo o ID da Página
        const pageId = payload?.entry?.[0]?.id;
        if (!pageId) {
          logError("Meta page ID not found in payload");
          return new Response("Page ID missing", { status: 400 });
        }

        const { data: page } = await dbAdmin
          .from("facebook_pages")
          .select("user_id, status")
          .eq("page_id", pageId)
          .maybeSingle();

        if (!page) {
          logError(`Nenhuma página conectada localizada para page_id: ${pageId}`);
          return new Response("Page not integrated", { status: 404 });
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
            .eq("user_id", page.user_id)
            .eq("channel", "messenger")
            .eq("provider_message_id", firstMsg.mid)
            .maybeSingle();
          if (existingDm) {
            logInfo("Evento duplicado ignorado (mid já processado)", { mid: firstMsg.mid });
            return new Response("EVENT_RECEIVED", { status: 200 });
          }
        }

        // Salvar evento no banco para auditoria
        const { data: eventRow } = await dbAdmin
          .from("facebook_webhook_events")
          .insert({
            user_id: page.user_id,
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
                    const phonePlaceholder = `fb_${senderId}`;
                    const name = `Facebook User (${senderId})`;

                    // 1. Criar ou atualizar contato
                    const { data: contact } = await dbAdmin
                      .from("contacts")
                      .upsert(
                        {
                          user_id: page.user_id,
                          phone_e164: phonePlaceholder,
                          name: name,
                          channel: "messenger",
                          external_contact_id: senderId,
                          source: "messenger",
                        },
                        { onConflict: "user_id,channel,external_contact_id" }
                      )
                      .select("id")
                      .single();

                    // 2. Salvar mensagem recebida (com dedup via unique key)
                    await dbAdmin.from("direct_messages").upsert(
                      {
                        user_id: page.user_id,
                        contact_phone: phonePlaceholder,
                        direction: "incoming",
                        type: "text",
                        body: message.text,
                        channel: "messenger",
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
                      page.user_id,
                      undefined,
                      "messenger",
                    );
                  }
                }
              }

              if (eventRow?.id) {
                await dbAdmin
                  .from("facebook_webhook_events")
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
