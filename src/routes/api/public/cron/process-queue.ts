import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";

const BATCH = 60;
const STUCK_SENDING_MINUTES = 5;
const WEBHOOK_EVENTS_RETENTION_DAYS = 30;

async function processOnce() {
  // 0a. Recupera mensagens travadas em "sending" há > 5min → volta a "pending"
  const stuckCutoff = new Date(Date.now() - STUCK_SENDING_MINUTES * 60_000).toISOString();
  await supabaseAdmin
    .from("campaign_messages")
    .update({ status: "pending" })
    .eq("status", "sending")
    .lt("sent_at", stuckCutoff);
  // sent_at é null enquanto está "sending"; usamos created_at como fallback
  await supabaseAdmin
    .from("campaign_messages")
    .update({ status: "pending" })
    .eq("status", "sending")
    .is("sent_at", null)
    .lt("created_at", stuckCutoff);

  // 0b. Limpa webhook_events processados antigos (>30 dias)
  if (Math.random() < 0.1) {
    const retCutoff = new Date(Date.now() - WEBHOOK_EVENTS_RETENTION_DAYS * 86_400_000).toISOString();
    await supabaseAdmin
      .from("webhook_events")
      .delete()
      .eq("processed", true)
      .lt("received_at", retCutoff);
  }

  // Promove drafts agendados que já chegaram à hora
  await supabaseAdmin
    .from("campaigns")
    .update({ status: "queued" })
    .eq("status", "draft")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  // Fetch active campaigns first
  const { data: activeCampaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id, status, message_type, payload, template_id")
    .in("status", ["queued", "running"]);

  if (!activeCampaigns || activeCampaigns.length === 0) return { processed: 0 };
  const activeCampIds = activeCampaigns.map((c: any) => c.id);

  // Pick up to BATCH pending messages for active campaigns
  const { data: messages, error } = await supabaseAdmin
    .from("campaign_messages")
    .select("id, user_id, campaign_id, to_phone, contact_id, attempts, contacts(name, custom_fields)")
    .eq("status", "pending")
    .in("campaign_id", activeCampIds)
    .limit(BATCH);

  if (error) throw error;
  if (!messages || messages.length === 0) return { processed: 0 };

  // Attach campaign objects manually for the emulator compatibility
  const campMap = Object.fromEntries(activeCampaigns.map((c: any) => [c.id, c]));
  for (const m of messages) {
    (m as any).campaigns = campMap[m.campaign_id];
  }

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
      .select("whatsapp_phone_number_id, whatsapp_access_token, rate_limit_per_second, meta_graph_version")
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

    const apiVersion = profile.meta_graph_version || "v20.0";
    const url = `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_phone_number_id}/messages`;
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

function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

async function checkCronAuth(request: Request): Promise<Response | null> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("cron_secret")
    .eq("id", 1)
    .maybeSingle();
  const dbSecret = (data as any)?.cron_secret as string | null | undefined;
  const envSecret = process.env.CRON_SECRET;
  const secret = (dbSecret && dbSecret.trim()) || (envSecret && envSecret.trim()) || null;

  // Fail-closed in production: sem segredo configurado, o endpoint fica bloqueado.
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      return null; // Permite executar localmente para testes
    }
    return new Response(
      JSON.stringify({ ok: false, error: "cron_secret not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!timingSafeEqStr(header, secret)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export const Route = createFileRoute("/api/public/cron/process-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await checkCronAuth(request);
        if (unauthorized) return unauthorized;
        try {
          const result = await processOnce();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("cron processQueue error:", e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        const unauthorized = await checkCronAuth(request);
        if (unauthorized) return unauthorized;
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
