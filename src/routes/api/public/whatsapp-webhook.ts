import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";

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

function extractPhoneNumberIds(payload: any): string[] {
  const ids = new Set<string>();
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const phoneNumberId = change?.value?.metadata?.phone_number_id;
      if (phoneNumberId) ids.add(String(phoneNumberId));
    }
  }
  return Array.from(ids);
}

async function resolveWebhookUser(rawBody: string, signatureHeader: string | null, payload: any) {
  const { data: profiles } = await dbAdmin
    .from("profiles")
    .select("id, whatsapp_app_secret, whatsapp_phone_number_id")
    .not("whatsapp_app_secret", "is", null);

  const verifiedProfiles: Array<{
    id: string;
    whatsapp_app_secret?: string | null;
    whatsapp_phone_number_id?: string | null;
  }> = [];

  for (const profile of profiles ?? []) {
    if (
      profile.whatsapp_app_secret &&
      (await verifySignature(rawBody, signatureHeader, profile.whatsapp_app_secret))
    ) {
      verifiedProfiles.push(profile as any);
    }
  }

  if (verifiedProfiles.length === 0) {
    return { userId: null, reason: "invalid_signature" as const };
  }

  const payloadPhoneIds = extractPhoneNumberIds(payload);
  if (payloadPhoneIds.length > 0) {
    const byPhoneId = verifiedProfiles.filter((profile) =>
      profile.whatsapp_phone_number_id && payloadPhoneIds.includes(String(profile.whatsapp_phone_number_id)),
    );

    if (byPhoneId.length === 1) {
      return { userId: byPhoneId[0].id, reason: "phone_number_id" as const };
    }

    if (byPhoneId.length > 1) {
      return { userId: null, reason: "ambiguous_phone_number_id" as const };
    }
  }

  if (verifiedProfiles.length === 1) {
    return { userId: verifiedProfiles[0].id, reason: "signature_only" as const };
  }

  return { userId: null, reason: "ambiguous_signature" as const };
}

const OPT_OUT_KEYWORDS = [
  "stop",
  "sair",
  "parar",
  "cancelar",
  "descadastrar",
  "unsubscribe",
  "remover",
];

async function processStatusUpdate(value: any, userId: string) {
  const statuses = value?.statuses ?? [];
  for (const s of statuses) {
    const waId: string | undefined = s.id;
    if (!waId) continue;
    const status = s.status;
    const timestamp = s.timestamp
      ? new Date(Number(s.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const update: any = {};

    const allowedCampaignStatuses = ["pending", "sending", "sent", "delivered", "read", "failed"];
    if (allowedCampaignStatuses.includes(status)) {
      update.status = status;
    }

    if (status === "delivered") update.delivered_at = timestamp;
    if (status === "read") update.read_at = timestamp;
    if (status === "failed") {
      update.failed_at = timestamp;
      update.error = s.errors ?? null;
    }
    if (s.pricing) {
      update.pricing_billable = s.pricing.billable ?? null;
      update.pricing_category = s.pricing.category ?? null;
      update.pricing_model = s.pricing.pricing_model ?? null;
    }
    if (s.conversation) {
      update.conversation_id = s.conversation.id ?? null;
      update.conversation_origin = s.conversation.origin?.type ?? null;
    }

    // SECURITY: scope mutation to the verified user
    let rows: any[] | null = null;
    if (Object.keys(update).length > 0) {
      const { data } = await dbAdmin
        .from("campaign_messages")
        .update(update)
        .eq("wa_message_id", waId)
        .eq("user_id", userId)
        .select("campaign_id");
      rows = data;
    }

    // Update status in direct_messages table too
    const allowedDirectStatuses = ["sent", "delivered", "read", "failed"];
    if (allowedDirectStatuses.includes(status)) {
      await dbAdmin
        .from("direct_messages")
        .update({ status })
        .eq("wa_message_id", waId)
        .eq("user_id", userId);
    }

    const campaignIds = Array.from(new Set((rows ?? []).map((r: any) => r.campaign_id)));
    for (const cid of campaignIds) {
      const { data: agg } = await dbAdmin
        .from("campaign_messages")
        .select("status")
        .eq("campaign_id", cid)
        .eq("user_id", userId);
      if (!agg) continue;
      const totals: any = {
        total: agg.length,
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
      for (const r of agg) totals[r.status] = (totals[r.status] ?? 0) + 1;
      await dbAdmin.from("campaigns").update({ totals }).eq("id", cid).eq("user_id", userId);
    }
  }
}

async function processInboundMessages(value: any, userId: string) {
  const messages = value?.messages ?? [];
  for (const m of messages) {
    const from: string | undefined = m.from;
    if (!from) continue;
    const text = (m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "")
      .toString()
      .trim()
      .toLowerCase();
    if (!text) continue;
    const isOptOut = OPT_OUT_KEYWORDS.some(
      (k) => text === k || text.startsWith(`${k} `) || text.endsWith(` ${k}`),
    );
    if (!isOptOut) continue;
    // Contatos salvos sem "+" (apenas dígitos com DDI). Meta envia sem "+" também.
    const phoneDigits = from.replace(/\D+/g, "");
    await dbAdmin
      .from("contacts")
      .update({ opted_out: true })
      .eq("user_id", userId)
      .eq("phone_e164", phoneDigits);
  }
}

async function processInboundDirectMessages(value: any, userId: string) {
  const messages = value?.messages ?? [];
  for (const m of messages) {
    const from: string | undefined = m.from;
    if (!from) continue;
    const phoneDigits = from.replace(/\D+/g, "");

    let type = m.type ?? "text";
    if (type !== "text" && type !== "reaction" && type !== "image") {
      type = "text";
    }

    let body = "";
    if (m.type === "text") {
      body = m.text?.body ?? "";
    } else if (m.type === "reaction") {
      body = m.reaction?.emoji ?? "";
    } else if (m.type === "image") {
      body = m.image?.id ?? "";
    } else {
      body = `[Mensagem de tipo ${m.type} recebida]`;
    }

    const reply_to_message_id = m.context?.message_id ?? null;

    // Salva na tabela direct_messages
    await dbAdmin.from("direct_messages").insert({
      user_id: userId,
      contact_phone: phoneDigits,
      direction: "incoming",
      type,
      body,
      wa_message_id: m.id,
      status: "read",
      reply_to_message_id,
      metadata: m,
    });
  }
}

async function processTemplateStatusUpdate(value: any, userId: string) {
  const metaId = value?.message_template_id ? String(value.message_template_id) : null;
  const name = value?.message_template_name as string | undefined;
  const language = value?.message_template_language as string | undefined;
  const event = (value?.event as string | undefined)?.toUpperCase();
  const statusMap: Record<string, string> = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    PENDING: "PENDING",
    IN_APPEAL: "PENDING",
    PENDING_DELETION: "PENDING",
    DELETED: "DISABLED",
    DISABLED: "DISABLED",
    PAUSED: "PAUSED",
    FLAGGED: "PAUSED",
    REINSTATED: "APPROVED",
  };
  const status = event && statusMap[event];
  if (!status) return;
  const update: any = { status, synced_at: new Date().toISOString() };
  if (metaId) {
    await dbAdmin
      .from("templates")
      .update(update)
      .eq("meta_template_id", metaId)
      .eq("user_id", userId);
  } else if (name && language) {
    await dbAdmin
      .from("templates")
      .update(update)
      .eq("name", name)
      .eq("language", language)
      .eq("user_id", userId);
  }
}

async function processTemplateCategoryUpdate(value: any, userId: string) {
  const metaId = value?.message_template_id ? String(value.message_template_id) : null;
  const newCategory = value?.new_category as string | undefined;
  if (!metaId || !newCategory) return;
  await dbAdmin
    .from("templates")
    .update({ category: newCategory, synced_at: new Date().toISOString() })
    .eq("meta_template_id", metaId)
    .eq("user_id", userId);
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode !== "subscribe" || !token) return new Response("Bad Request", { status: 400 });
        const { data: profiles } = await dbAdmin
          .from("profiles")
          .select("id")
          .eq("whatsapp_verify_token", token)
          .limit(1);
        if (!profiles || profiles.length === 0) return new Response("Forbidden", { status: 403 });
        return new Response(challenge ?? "", { status: 200 });
      },
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        const payload = JSON.parse(rawBody);
        const resolved = await resolveWebhookUser(rawBody, sig, payload);
        const matchedUserId = resolved.userId;

        if (!matchedUserId) {
          await dbAdmin
            .from("webhook_events")
            .insert({
              source: "whatsapp",
              raw: {
                rejected: true,
                reason: resolved.reason,
                phone_number_ids: extractPhoneNumberIds(payload),
                body: rawBody.slice(0, 4000),
              },
            });
          return new Response("Webhook user could not be resolved", { status: 401 });
        }
        const { data: evRow } = await dbAdmin
          .from("webhook_events")
          .insert({ source: "whatsapp", raw: payload, user_id: matchedUserId })
          .select("id")
          .single();

        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            if (change.field === "messages") {
              await processStatusUpdate(change.value, matchedUserId);
              await processInboundMessages(change.value, matchedUserId);
              await processInboundDirectMessages(change.value, matchedUserId);
            } else if (change.field === "message_template_status_update") {
              await processTemplateStatusUpdate(change.value, matchedUserId);
            } else if (change.field === "template_category_update") {
              await processTemplateCategoryUpdate(change.value, matchedUserId);
            }
          }
        }

        if (evRow?.id) {
          await dbAdmin.from("webhook_events").update({ processed: true }).eq("id", evRow.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
