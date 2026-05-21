import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function processStatusUpdate(value: any) {
  const statuses = value?.statuses ?? [];
  for (const s of statuses) {
    const waId: string | undefined = s.id;
    if (!waId) continue;
    const status = s.status; // sent | delivered | read | failed
    const timestamp = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
    const update: any = { status };
    if (status === "delivered") update.delivered_at = timestamp;
    if (status === "read") update.read_at = timestamp;
    if (status === "failed") {
      update.failed_at = timestamp;
      update.error = s.errors ?? null;
    }
    // Capturar dados de cobrança (Meta envia em sent/delivered)
    if (s.pricing) {
      update.pricing_billable = s.pricing.billable ?? null;
      update.pricing_category = s.pricing.category ?? null;
      update.pricing_model = s.pricing.pricing_model ?? null;
    }
    if (s.conversation) {
      update.conversation_id = s.conversation.id ?? null;
      update.conversation_origin = s.conversation.origin?.type ?? null;
    }

    const { data: rows } = await supabaseAdmin
      .from("campaign_messages")
      .update(update)
      .eq("wa_message_id", waId)
      .select("campaign_id");

    // Update campaign totals
    const campaignIds = Array.from(new Set((rows ?? []).map((r: any) => r.campaign_id)));
    for (const cid of campaignIds) {
      const { data: agg } = await supabaseAdmin
        .from("campaign_messages")
        .select("status")
        .eq("campaign_id", cid);
      if (!agg) continue;
      const totals: any = { total: agg.length, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
      for (const r of agg) totals[r.status] = (totals[r.status] ?? 0) + 1;
      await supabaseAdmin.from("campaigns").update({ totals }).eq("id", cid);
    }
  }
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      // Meta verification
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode !== "subscribe" || !token) return new Response("Bad Request", { status: 400 });

        // Match against any user's verify_token
        const { data: profiles } = await supabaseAdmin
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

        // Try to verify against each user's app_secret
        let verified = false;
        const { data: secrets } = await supabaseAdmin
          .from("profiles")
          .select("whatsapp_app_secret")
          .not("whatsapp_app_secret", "is", null);
        for (const s of secrets ?? []) {
          if (s.whatsapp_app_secret && await verifySignature(rawBody, sig, s.whatsapp_app_secret)) {
            verified = true;
            break;
          }
        }
        if (!verified) {
          // store anyway for audit but reject
          await supabaseAdmin.from("webhook_events").insert({ raw: { rejected: true, body: rawBody.slice(0, 4000) } });
          return new Response("Invalid signature", { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        await supabaseAdmin.from("webhook_events").insert({ raw: payload });

        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            if (change.field === "messages") {
              await processStatusUpdate(change.value);
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
