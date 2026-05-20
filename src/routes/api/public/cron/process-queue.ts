import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";

const BATCH = 60;

async function processOnce() {
  // Pick up to BATCH pending messages whose campaign is queued or running
  const { data: messages, error } = await supabaseAdmin
    .from("campaign_messages")
    .select("id, user_id, campaign_id, to_phone, contact_id, attempts, campaigns!inner(status, message_type, payload, template_id), contacts(name, custom_fields)")
    .eq("status", "pending")
    .in("campaigns.status", ["queued", "running"])
    .limit(BATCH);

  if (error) throw error;
  if (!messages || messages.length === 0) return { processed: 0 };

  // Group by user to fetch credentials once per user
  const byUser = new Map<string, any[]>();
  for (const m of messages) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id)!.push(m);
  }

  let processed = 0;

  for (const [userId, msgs] of byUser) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, rate_limit_per_second")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.whatsapp_phone_number_id || !profile?.whatsapp_access_token) {
      const ids = msgs.map((x) => x.id);
      await supabaseAdmin
        .from("campaign_messages")
        .update({ status: "failed", failed_at: new Date().toISOString(), error: { message: "Credenciais não configuradas" } })
        .in("id", ids);
      continue;
    }

    // mark campaigns as running
    const campIds = Array.from(new Set(msgs.map((m: any) => m.campaign_id)));
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "running", started_at: new Date().toISOString() })
      .in("id", campIds)
      .eq("status", "queued");

    const url = `https://graph.facebook.com/v20.0/${profile.whatsapp_phone_number_id}/messages`;
    const delayMs = Math.max(20, Math.floor(1000 / (profile.rate_limit_per_second || 20)));

    for (const m of msgs) {
      // mark sending
      await supabaseAdmin.from("campaign_messages").update({ status: "sending", attempts: (m.attempts ?? 0) + 1 }).eq("id", m.id);

      try {
        const payload = buildWhatsAppPayload(
          (m as any).campaigns.message_type,
          m.to_phone,
          (m as any).campaigns.payload,
          (m as any).contacts,
        );
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${profile.whatsapp_access_token}` },
          body: JSON.stringify(payload),
        });
        const body: any = await r.json();
        if (!r.ok) {
          await supabaseAdmin
            .from("campaign_messages")
            .update({ status: "failed", failed_at: new Date().toISOString(), error: body?.error ?? body })
            .eq("id", m.id);
        } else {
          const waId = body?.messages?.[0]?.id ?? null;
          await supabaseAdmin
            .from("campaign_messages")
            .update({ status: "sent", sent_at: new Date().toISOString(), wa_message_id: waId, error: null })
            .eq("id", m.id);
        }
      } catch (e: any) {
        await supabaseAdmin
          .from("campaign_messages")
          .update({ status: "failed", failed_at: new Date().toISOString(), error: { message: e.message } })
          .eq("id", m.id);
      }
      processed++;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Recompute campaign totals + maybe mark done
    for (const cid of campIds) {
      const { data: agg } = await supabaseAdmin
        .from("campaign_messages")
        .select("status")
        .eq("campaign_id", cid);
      if (!agg) continue;
      const totals = { total: agg.length, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 } as any;
      for (const r of agg) totals[r.status] = (totals[r.status] ?? 0) + 1;
      const remaining = totals.pending + (agg.filter((r: any) => r.status === "sending").length);
      const updates: any = { totals };
      if (remaining === 0) {
        updates.status = totals.failed === totals.total ? "failed" : "done";
        updates.finished_at = new Date().toISOString();
      }
      await supabaseAdmin.from("campaigns").update(updates).eq("id", cid);
    }
  }

  return { processed };
}

export const Route = createFileRoute("/api/public/cron/process-queue")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processOnce();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("cron processQueue error:", e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const result = await processOnce();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
    },
  },
});
