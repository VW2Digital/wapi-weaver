import { createFileRoute } from "@tanstack/react-router";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";

const BATCH = 60;
const STUCK_SENDING_MINUTES = 5;
const WEBHOOK_EVENTS_RETENTION_DAYS = 30;

function extractTemplatePlaceholders(components: any[] = []) {
  const placeholders: string[] = [];

  components.forEach((component: any) => {
    if (component?.type === "HEADER" && component.format === "TEXT") {
      const matches = String(component.text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
      matches.forEach((m) => {
        const token = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
        if (token && !placeholders.includes(`header_${token}`)) {
          placeholders.push(`header_${token}`);
        }
      });
    }

    if (component?.type === "BODY") {
      const matches = String(component.text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
      matches.forEach((m) => {
        const token = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
        if (token && !placeholders.includes(token)) {
          placeholders.push(token);
        }
      });
    }

    if (component?.type === "BUTTONS" && Array.isArray(component.buttons)) {
      component.buttons.forEach((button: any, btnIndex: number) => {
        if (button?.type === "URL") {
          const matches = String(button.url ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
          matches.forEach((m) => {
            const token = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
            const key = `button_${btnIndex}_${token}`;
            if (token && !placeholders.includes(key)) {
              placeholders.push(key);
            }
          });
        }
      });
    }
  });

  return placeholders;
}

function buildTemplateLookupKey(name?: string | null, language?: string | null) {
  return `${String(name ?? "")
    .trim()
    .toLowerCase()}::${String(language ?? "")
    .trim()
    .toLowerCase()}`;
}

function assertTemplatePayload(payload: any) {
  if (
    !payload?.to ||
    !payload?.template?.name ||
    !payload?.template?.language?.code ||
    payload?.messaging_product !== "whatsapp" ||
    payload?.type !== "template"
  ) {
    throw new Error("Payload inválido: campo obrigatório nulo — " + JSON.stringify(payload));
  }
}

export async function processOnce() {
  // 0a. Recupera mensagens travadas em "sending" há > 5min → volta a "pending"
  const stuckCutoff = new Date(Date.now() - STUCK_SENDING_MINUTES * 60_000).toISOString();
  await dbAdmin
    .from("campaign_messages")
    .update({ status: "pending" })
    .eq("status", "sending")
    .lt("sent_at", stuckCutoff);
  // sent_at é null enquanto está "sending"; usamos created_at como fallback
  await dbAdmin
    .from("campaign_messages")
    .update({ status: "pending" })
    .eq("status", "sending")
    .is("sent_at", null)
    .lt("created_at", stuckCutoff);

  // 0b. Limpa webhook_events processados antigos (>30 dias)
  if (Math.random() < 0.1) {
    const retCutoff = new Date(
      Date.now() - WEBHOOK_EVENTS_RETENTION_DAYS * 86_400_000,
    ).toISOString();
    await dbAdmin
      .from("webhook_events")
      .delete()
      .eq("processed", true)
      .lt("received_at", retCutoff);
  }

  // Promove drafts agendados que já chegaram à hora
  await dbAdmin
    .from("campaigns")
    .update({ status: "queued" })
    .eq("status", "draft")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  // Fetch active campaigns first
  const { data: activeCampaigns } = await dbAdmin
    .from("campaigns")
    .select("id, status, message_type, payload, template_id")
    .in("status", ["queued", "running"]);

  if (!activeCampaigns || activeCampaigns.length === 0) return { processed: 0 };
  const activeCampIds = activeCampaigns.map((c: any) => c.id);
  const templateIds = Array.from(
    new Set(
      activeCampaigns
        .filter((campaign: any) => campaign.message_type === "template" && campaign.template_id)
        .map((campaign: any) => campaign.template_id),
    ),
  );

  let templateMap: Record<string, any> = {};
  let templateByNameLang: Record<string, any> = {};
  if (templateIds.length > 0) {
    const { data: templates } = await dbAdmin
      .from("templates")
      .select("id, name, language, components, parameter_format")
      .in("id", templateIds);
    templateMap = Object.fromEntries(
      (templates ?? []).map((template: any) => [template.id, template]),
    );
  }

  const { data: allApprovedTemplates } = await dbAdmin
    .from("templates")
    .select("id, name, language, components, parameter_format, status, meta_template_id")
    .eq("status", "APPROVED")
    .not("meta_template_id", "is", null);
  templateByNameLang = Object.fromEntries(
    (allApprovedTemplates ?? []).map((template: any) => [
      buildTemplateLookupKey(template.name, template.language),
      template,
    ]),
  );

  // Pick up to BATCH pending messages for active campaigns (exclui Instagram)
  const { data: messages, error } = await dbAdmin
    .from("campaign_messages")
    .select(
      "id, user_id, campaign_id, to_phone, contact_id, attempts, contacts(name, custom_fields, channel)",
    )
    .eq("status", "pending")
    .in("campaign_id", activeCampIds)
    .limit(BATCH);

  if (error) throw error;
  if (!messages || messages.length === 0) return { processed: 0 };

  // Attach campaign objects manually for the emulator compatibility
  const campMap = Object.fromEntries(activeCampaigns.map((c: any) => [c.id, c]));
  for (const m of messages) {
    (m as any).campaigns = campMap[m.campaign_id];
    const campaignTemplateId = (m as any).campaigns?.template_id;
    if (campaignTemplateId) {
      (m as any).template = templateMap[campaignTemplateId] ?? null;
    }
  }

  // Group by user to fetch credentials once per user
  const byUser = new Map<string, any[]>();
  for (const m of messages) {
    if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
    byUser.get(m.user_id)!.push(m);
  }

  let processed = 0;

  for (const [userId, msgs] of byUser) {
    const { data: profile } = await dbAdmin
      .from("profiles")
      .select(
        "whatsapp_phone_number_id, whatsapp_access_token, rate_limit_per_second, meta_graph_version",
      )
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.whatsapp_phone_number_id || !profile?.whatsapp_access_token) {
      const ids = msgs.map((x) => x.id);
      await dbAdmin
        .from("campaign_messages")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          error: { message: "Credenciais não configuradas" },
        })
        .in("id", ids);
      continue;
    }

    // mark campaigns as running
    const campIds = Array.from(new Set(msgs.map((m: any) => m.campaign_id)));
    await dbAdmin
      .from("campaigns")
      .update({ status: "running", started_at: new Date().toISOString() })
      .in("id", campIds)
      .eq("status", "queued");

    const apiVersion = profile.meta_graph_version || "v20.0";
    const url = `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_phone_number_id}/messages`;
    const delayMs = Math.max(20, Math.floor(1000 / (profile.rate_limit_per_second || 20)));

    for (const m of msgs) {
      // Pular contatos do Instagram (disparo em massa proibido)
      if ((m as any)?.contacts?.channel === "instagram" || String(m.to_phone).startsWith("ig_")) {
        await dbAdmin
          .from("campaign_messages")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error: { message: "Instagram não é permitido em campanhas de disparo em massa." },
          })
          .eq("id", m.id);
        processed++;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      // mark sending
      await dbAdmin
        .from("campaign_messages")
        .update({ status: "sending", attempts: (m.attempts ?? 0) + 1 })
        .eq("id", m.id);

      let campaignPayload: any = {};
      try {
        campaignPayload = { ...((m as any).campaigns.payload ?? {}) };
        let linkedTemplate = (m as any).template;
        if ((m as any).campaigns.message_type === "template" && !linkedTemplate) {
          const resolvedTemplate =
            templateByNameLang[
              buildTemplateLookupKey(campaignPayload.template_name, campaignPayload.language)
            ] ?? null;

          if (resolvedTemplate) {
            linkedTemplate = resolvedTemplate;
            (m as any).template = resolvedTemplate;
            await dbAdmin
              .from("campaigns")
              .update({ template_id: resolvedTemplate.id })
              .eq("id", (m as any).campaign_id)
              .is("template_id", null);
          }
        }

        if ((m as any).campaigns.message_type === "template" && !linkedTemplate) {
          await dbAdmin
            .from("campaign_messages")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error: {
                message:
                  "Este template não existe ou não está aprovado na conta WhatsApp conectada. Escolha um template aprovado da lista e recrie a campanha.",
                code: "template_not_found",
                template_name: campaignPayload.template_name ?? null,
                language: campaignPayload.language ?? null,
              },
            })
            .eq("id", m.id);
          processed++;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if ((m as any).campaigns.message_type === "template" && linkedTemplate) {
          if (!campaignPayload.template_name) campaignPayload.template_name = linkedTemplate.name;
          if (!campaignPayload.language) campaignPayload.language = linkedTemplate.language;
          if (!campaignPayload.template_components) {
            campaignPayload.template_components = linkedTemplate.components ?? [];
          }
          if (!campaignPayload.template_placeholders) {
            campaignPayload.template_placeholders = extractTemplatePlaceholders(
              linkedTemplate.components ?? [],
            );
          }
          if (!campaignPayload.parameter_format && linkedTemplate.parameter_format) {
            campaignPayload.parameter_format = linkedTemplate.parameter_format;
          }
        }

        const payload = buildWhatsAppPayload(
          (m as any).campaigns.message_type,
          m.to_phone,
          campaignPayload,
          (m as any).contacts,
        );
        if ((m as any).campaigns.message_type === "template") {
          assertTemplatePayload(payload);
        }
        console.log("PAYLOAD ENVIADO:", JSON.stringify(payload, null, 2));
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${profile.whatsapp_access_token}`,
          },
          body: JSON.stringify(payload),
        });
        const body: any = await r.json();
        if (!r.ok) {
          console.error("ERRO META:", JSON.stringify(body?.error ?? body, null, 2));
          await dbAdmin
            .from("campaign_messages")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error: {
                ...(body?.error ?? body),
                request_payload: payload,
              },
            })
            .eq("id", m.id);
        } else {
          const waId = body?.messages?.[0]?.id ?? null;
          await dbAdmin
            .from("campaign_messages")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              wa_message_id: waId,
              error: null,
            })
            .eq("id", m.id);
        }
      } catch (e: any) {
        await dbAdmin
          .from("campaign_messages")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error: {
              message: e.message,
              request_payload: {
                campaign_id: (m as any).campaign_id,
                to_phone: m.to_phone,
                campaign_payload: campaignPayload,
              },
            },
          })
          .eq("id", m.id);
      }
      processed++;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Recompute campaign totals + maybe mark done
    const { default: db } = await import("@/lib/db");
    for (const cid of campIds) {
      const rows = (await db.query(
        "SELECT status, COUNT(*) as count FROM campaign_messages WHERE campaign_id = ? GROUP BY status",
        [cid]
      )) as any[];

      const totals = {
        total: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      } as any;

      for (const row of rows ?? []) {
        const status = row.status;
        const count = Number(row.count || 0);
        totals[status] = count;
        totals.total += count;
      }

      const remaining = (totals.pending || 0) + (totals.sending || 0);
      const updates: any = { totals };
      if (remaining === 0) {
        updates.status = totals.failed === totals.total ? "failed" : "done";
        updates.finished_at = new Date().toISOString();
      }
      await dbAdmin.from("campaigns").update(updates).eq("id", cid);
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
  const { data } = await dbAdmin
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
    return new Response(JSON.stringify({ ok: false, error: "cron_secret not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
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
