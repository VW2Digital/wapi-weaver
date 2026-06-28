import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { resolveEffectiveUserId } from "./chat-helpers";
import db from "./db";
import { recordAudit } from "./audit.functions";

const payloadSchema = z.object({
  // For template messages
  template_name: z.string().optional(),
  language: z.string().optional(),
  variables: z.array(z.string()).optional(), // body variables in order
  template_components: z.array(z.any()).optional(),
  template_placeholders: z.array(z.string()).optional(),
  parameter_format: z.enum(["NAMED", "POSITIONAL"]).optional(),
  header_image_url: z.string().url().optional(),
  header_image_id: z.string().optional(),
  header_media_id: z.string().optional(),
  header_media_link: z.string().url().optional(),
  header_video_id: z.string().optional(),
  header_video_url: z.string().url().optional(),
  header_document_id: z.string().optional(),
  header_document_url: z.string().url().optional(),
  header_document_filename: z.string().max(255).optional(),
  // For text/media
  text: z.string().max(4096).optional(),
  media_type: z.enum(["image", "document", "video"]).optional(),
  media_url: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
  filename: z.string().max(200).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  message_type: z.enum(["template", "text", "media", "interactive"]),
  template_id: z.string().uuid().nullable().optional(),
  list_id: z.string().uuid(),
  payload: payloadSchema,
  scheduled_at: z.string().datetime().nullable().optional(),
  start_now: z.boolean().default(true),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

function buildTemplateLookupKey(name?: string | null, language?: string | null) {
  return `${String(name ?? "")
    .trim()
    .toLowerCase()}::${String(language ?? "")
    .trim()
    .toLowerCase()}`;
}

async function attachTemplateDiagnostics(db: any, campaigns: any[]) {
  if (!campaigns.length) return campaigns;

  const templateIds = Array.from(
    new Set(
      campaigns
        .filter((campaign) => campaign.message_type === "template" && campaign.template_id)
        .map((campaign) => campaign.template_id),
    ),
  );

  let templatesById: Record<string, any> = {};
  if (templateIds.length > 0) {
    const { data: linkedTemplates, error } = await db
      .from("templates")
      .select("id, name, language, status, meta_template_id")
      .in("id", templateIds);
    if (error) throw error;
    templatesById = Object.fromEntries(
      (linkedTemplates ?? []).map((template: any) => [template.id, template]),
    );
  }

  const { data: approvedTemplates, error: approvedErr } = await db
    .from("templates")
    .select("id, name, language, status, meta_template_id")
    .eq("status", "APPROVED")
    .not("meta_template_id", "is", null);
  if (approvedErr) throw approvedErr;

  const approvedByNameLang = Object.fromEntries(
    (approvedTemplates ?? []).map((template: any) => [
      buildTemplateLookupKey(template.name, template.language),
      template,
    ]),
  );

  return campaigns.map((campaign) => {
    if (campaign.message_type !== "template") {
      return { ...campaign, template_diagnostic: { status: "ok" } };
    }

    const linkedTemplate = campaign.template_id
      ? (templatesById[campaign.template_id] ?? null)
      : null;
    const payloadName = campaign.payload?.template_name ?? null;
    const payloadLanguage = campaign.payload?.language ?? null;
    const payloadTemplate =
      approvedByNameLang[buildTemplateLookupKey(payloadName, payloadLanguage)] ?? null;

    if (linkedTemplate?.status === "APPROVED" && linkedTemplate?.meta_template_id) {
      return {
        ...campaign,
        template_diagnostic: {
          status: "ok",
          template_id: linkedTemplate.id,
          template_name: linkedTemplate.name,
          language: linkedTemplate.language,
        },
      };
    }

    if (!campaign.template_id && payloadTemplate) {
      return {
        ...campaign,
        template_diagnostic: {
          status: "legacy_unlinked",
          template_id: payloadTemplate.id,
          template_name: payloadTemplate.name,
          language: payloadTemplate.language,
          message:
            "Essa campanha é antiga e ainda não está vinculada ao template salvo no sistema, mas pode ser resolvida automaticamente no envio.",
        },
      };
    }

    return {
      ...campaign,
      template_diagnostic: {
        status: "invalid",
        template_id: linkedTemplate?.id ?? null,
        template_name: linkedTemplate?.name ?? payloadName,
        language: linkedTemplate?.language ?? payloadLanguage,
        message:
          "Essa campanha usa um template inexistente, não aprovado ou desconectado da conta WhatsApp atual.",
      },
    };
  });
}

async function validateTemplateForCampaign(db: any, data: z.infer<typeof createSchema>) {
  if (data.message_type !== "template") return;

  if (!data.template_id) {
    throw new Error("Selecione um template aprovado antes de criar a campanha.");
  }

  const { data: template, error: templateErr } = await db
    .from("templates")
    .select("id, name, language, status, meta_template_id")
    .eq("id", data.template_id)
    .maybeSingle();
  if (templateErr) throw templateErr;

  if (!template) {
    throw new Error("O template selecionado não foi encontrado.");
  }

  if (template.status !== "APPROVED" || !template.meta_template_id) {
    throw new Error(
      "Esse template ainda não está aprovado na Meta e não pode ser usado em campanha.",
    );
  }
}

async function fetchEligibleContactsForList(db: any, listId: string) {
  const { data: lcRows, error: lcErr } = await db
    .from("list_contacts")
    .select("contact_id, contacts(id, phone_e164, opted_out, channel)")
    .eq("list_id", listId);
  if (lcErr) throw lcErr;

  const contacts = (lcRows ?? [])
    .map((r: any) => r.contacts)
    .filter((c: any) => c && !c.opted_out && c.channel !== "instagram");

  if (contacts.length === 0) throw new Error("Lista sem contatos válidos");
  return contacts;
}

async function rebuildCampaignQueue(db: any, context: any, campaignId: string, contacts: any[]) {
  const { error: deleteErr } = await db
    .from("campaign_messages")
    .delete()
    .eq("campaign_id", campaignId);
  if (deleteErr) throw deleteErr;

  const chunkSize = 500;
  for (let i = 0; i < contacts.length; i += chunkSize) {
    const slice = contacts.slice(i, i + chunkSize).map((c: any) => ({
      user_id: context.userId,
      campaign_id: campaignId,
      contact_id: c.id,
      to_phone: c.phone_e164,
      status: "pending" as const,
    }));
    const { error: insErr } = await db.from("campaign_messages").insert(slice);
    if (insErr) throw insErr;
  }
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    // Recalcular totais para todas as campanhas do usuário (exceto rascunhos) antes de listar
    await db.query(
      `
      UPDATE campaigns c
      SET totals = (
        SELECT JSON_OBJECT(
          'total', COUNT(*),
          'pending', CAST(COALESCE(SUM(status='pending'), 0) AS SIGNED),
          'sending', CAST(COALESCE(SUM(status='sending'), 0) AS SIGNED),
          'sent', CAST(COALESCE(SUM(status='sent'), 0) AS SIGNED),
          'delivered', CAST(COALESCE(SUM(status='delivered'), 0) AS SIGNED),
          'read', CAST(COALESCE(SUM(status='read'), 0) AS SIGNED),
          'failed', CAST(COALESCE(SUM(status='failed'), 0) AS SIGNED)
        ) FROM campaign_messages WHERE campaign_id = c.id AND user_id = ?
      )
      WHERE c.user_id = ? AND c.status != 'draft'
    `,
      [effectiveUserId, effectiveUserId],
    );

    const data: any[] = (await db.query(
      `SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [effectiveUserId],
    )) as any[];
    return attachTemplateDiagnostics(context.db, data ?? []);
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    // Recalcular totais para a campanha específica antes de detalhar
    await db.query(
      `
      UPDATE campaigns c
      SET totals = (
        SELECT JSON_OBJECT(
          'total', COUNT(*),
          'pending', CAST(COALESCE(SUM(status='pending'), 0) AS SIGNED),
          'sending', CAST(COALESCE(SUM(status='sending'), 0) AS SIGNED),
          'sent', CAST(COALESCE(SUM(status='sent'), 0) AS SIGNED),
          'delivered', CAST(COALESCE(SUM(status='delivered'), 0) AS SIGNED),
          'read', CAST(COALESCE(SUM(status='read'), 0) AS SIGNED),
          'failed', CAST(COALESCE(SUM(status='failed'), 0) AS SIGNED)
        ) FROM campaign_messages WHERE campaign_id = c.id AND user_id = ?
      )
      WHERE c.id = ? AND c.user_id = ?
    `,
      [effectiveUserId, data.id, effectiveUserId],
    );

    const campaigns: any[] = (await db.query(
      `SELECT * FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
      [data.id, effectiveUserId],
    )) as any[];
    const campaign = campaigns?.[0] ?? null;
    if (!campaign) return { campaign: null, messages: [], template: null };
    const messages: any[] = (await db.query(
      `SELECT cm.*, c.name AS contact_name FROM campaign_messages cm
       LEFT JOIN contacts c ON c.phone_e164 = cm.to_phone AND c.user_id = cm.user_id
       WHERE cm.campaign_id = ? AND cm.user_id = ?
       ORDER BY cm.created_at DESC LIMIT 500`,
      [data.id, effectiveUserId],
    )) as any[];

    let template = null;
    if (campaign.template_id) {
      const templates: any[] = (await db.query(
        `SELECT id, name, language, components, status, meta_template_id FROM templates
         WHERE id = ? AND user_id = ? LIMIT 1`,
        [campaign.template_id, effectiveUserId],
      )) as any[];
      template = templates?.[0] ?? null;
    }
    const [campaignWithDiagnostics] = await attachTemplateDiagnostics(context.db, [campaign]);
    return { campaign: campaignWithDiagnostics, messages: messages ?? [], template };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await validateTemplateForCampaign(context.db, data);
    const contacts = await fetchEligibleContactsForList(context.db, data.list_id);

    const status = data.start_now ? "queued" : "draft";
    const { data: campaign, error } = await context.db
      .from("campaigns")
      .insert({
        user_id: context.userId,
        name: data.name,
        message_type: data.message_type,
        template_id: data.template_id ?? null,
        list_id: data.list_id,
        payload: data.payload,
        scheduled_at: data.scheduled_at ?? null,
        status,
        totals: {
          total: contacts.length,
          pending: contacts.length,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        },
      })
      .select()
      .single();
    if (error) throw error;

    await rebuildCampaignQueue(context.db, context, campaign.id, contacts);

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "campaign.create",
      entityType: "campaign",
      entityId: campaign.id,
      metadata: { name: data.name, total: contacts.length, message_type: data.message_type },
    });

    return { campaign, queued: contacts.length };
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing, error: existingErr } = await context.db
      .from("campaigns")
      .select("id, name, status")
      .eq("id", data.id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing) throw new Error("Campanha não encontrada.");

    if (existing.status === "queued" || existing.status === "running") {
      throw new Error("Não é possível editar uma campanha que já está em andamento.");
    }

    await validateTemplateForCampaign(context.db, data);
    const contacts = await fetchEligibleContactsForList(context.db, data.list_id);
    const status = data.start_now ? "queued" : "draft";

    const { data: campaign, error } = await context.db
      .from("campaigns")
      .update({
        name: data.name,
        message_type: data.message_type,
        template_id: data.template_id ?? null,
        list_id: data.list_id,
        payload: data.payload,
        scheduled_at: data.scheduled_at ?? null,
        status,
        totals: {
          total: contacts.length,
          pending: contacts.length,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        },
        started_at: null,
        finished_at: null,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;

    await rebuildCampaignQueue(context.db, context, data.id, contacts);

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "campaign.update",
      entityType: "campaign",
      entityId: data.id,
      metadata: {
        previous_name: existing.name,
        name: data.name,
        total: contacts.length,
        message_type: data.message_type,
        reenqueued: true,
      },
    });

    return { campaign, queued: contacts.length };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Cancela mensagens que ainda não foram enviadas
    await context.db
      .from("campaign_messages")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error: { message: "Campanha cancelada pelo usuário" },
      })
      .eq("campaign_id", data.id)
      .in("status", ["pending", "sending"]);

    // Recalcula totais
    const { data: agg } = await context.db
      .from("campaign_messages")
      .select("status")
      .eq("campaign_id", data.id);
    const totals: any = {
      total: agg?.length ?? 0,
      pending: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };
    for (const r of agg ?? []) totals[r.status] = (totals[r.status] ?? 0) + 1;

    const { error } = await context.db
      .from("campaigns")
      .update({ status: "cancelled", totals, finished_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "campaign.cancel",
      entityType: "campaign",
      entityId: data.id,
    });
    return { ok: true };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.db
      .from("campaigns")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    const { error: mErr } = await context.db
      .from("campaign_messages")
      .delete()
      .eq("campaign_id", data.id);
    if (mErr) throw mErr;
    const { error } = await context.db.from("campaigns").delete().eq("id", data.id);
    if (error) throw error;
    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "campaign.delete",
      entityType: "campaign",
      entityId: data.id,
      metadata: { name: c?.name },
    });
    return { ok: true };
  });

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const exportCampaignReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const campaigns: any[] = (await db.query(
      `SELECT id, name, created_at, status FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
      [data.id, effectiveUserId],
    )) as any[];
    const campaign = campaigns?.[0];
    if (!campaign) throw new Error("Campanha não encontrada.");

    // Busca em páginas de 1000 registros
    const pageSize = 1000;
    let offset = 0;
    const all: any[] = [];
    while (true) {
      const rows: any[] = (await db.query(
        `SELECT cm.to_phone, cm.status, cm.attempts, cm.wa_message_id,
                cm.sent_at, cm.delivered_at, cm.read_at, cm.failed_at,
                cm.error, cm.contact_id,
                c.name AS contact_name, c.email AS contact_email
         FROM campaign_messages cm
         LEFT JOIN contacts c ON c.id = cm.contact_id AND c.user_id = cm.user_id
         WHERE cm.campaign_id = ? AND cm.user_id = ?
         ORDER BY cm.created_at ASC
         LIMIT ? OFFSET ?`,
        [data.id, effectiveUserId, pageSize, offset],
      )) as any[];
      if (!rows || rows.length === 0) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    const header = [
      "telefone",
      "nome",
      "email",
      "status",
      "tentativas",
      "wa_message_id",
      "enviado_em",
      "entregue_em",
      "lido_em",
      "falhou_em",
      "erro",
    ];
    const lines = [header.join(",")];
    for (const r of all) {
      lines.push(
        [
          csvEscape(r.to_phone),
          csvEscape(r.contact_name),
          csvEscape(r.contact_email),
          csvEscape(r.status),
          csvEscape(r.attempts),
          csvEscape(r.wa_message_id),
          csvEscape(r.sent_at),
          csvEscape(r.delivered_at),
          csvEscape(r.read_at),
          csvEscape(r.failed_at),
          csvEscape(r.error),
        ].join(","),
      );
    }

    await recordAudit({
      userId: context.userId,
      actorEmail: (context.claims as any)?.email,
      action: "campaign.export",
      entityType: "campaign",
      entityId: data.id,
      metadata: { rows: all.length },
    });

    return {
      filename: `campanha-${campaign.name.replace(/[^\w-]+/g, "_")}-${campaign.id.slice(0, 8)}.csv`,
      csv: lines.join("\n"),
      rows: all.length,
    };
  });
