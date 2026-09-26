import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";
import crypto from "crypto";
import { normalizeWaMessageId } from "@/lib/wa-message-id";
import { dbAdmin } from "@/integrations/mysql/client.server";

type SqlParams = unknown[];

interface ProfileConfigRow {
  whatsapp_phone_number_id?: string | null;
  whatsapp_waba_id?: string | null;
  whatsapp_access_token?: string | null;
  meta_graph_version?: string | null;
}

interface WhatsAppGroupRow {
  id: string;
  user_id?: string;
  instance_id?: string | null;
  group_id: string;
  name?: string | null;
  description?: string | null;
  invite_link?: string | null;
  status?: string | null;
}

interface WhatsAppGroupParticipantRow {
  group_id: string;
  user_id?: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface GroupIdRow {
  group_id?: string | null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function assertGroupsEnabled() {
  if (process.env.WHATSAPP_GROUPS_ENABLED === "false") {
    throw new Error("WHATSAPP_GROUPS_DISABLED");
  }
}

function graphVersion(raw?: string | null) {
  const v = String(raw || process.env.META_GRAPH_VERSION || "v26.0").trim();
  if (/^v2[4-6]\.\d+$/.test(v)) return v;
  return "v26.0";
}

function parseGraphError(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { message?: string; error_user_msg?: string } }).error;
    return err?.error_user_msg || err?.message || fallback;
  }
  return fallback;
}

function extractCreatedGroupId(body: Record<string, unknown>): string | null {
  if (typeof body.id === "string" && body.id) return body.id;
  const groups = body.groups;
  if (Array.isArray(groups) && groups[0] && typeof groups[0] === "object") {
    const id = (groups[0] as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  const data = body.data;
  if (data && typeof data === "object") {
    if (typeof (data as { id?: unknown }).id === "string") {
      return (data as { id: string }).id;
    }
    const nested = (data as { groups?: unknown }).groups;
    if (Array.isArray(nested) && nested[0] && typeof nested[0] === "object") {
      const id = (nested[0] as { id?: unknown }).id;
      if (typeof id === "string" && id) return id;
    }
  }
  return null;
}

async function loadProfile(userId: string) {
  const { default: db } = await import("./db");
  const profileRows = (await db.query(
    "SELECT whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_access_token, meta_graph_version FROM profiles WHERE id = ?",
    [userId],
  )) as ProfileConfigRow[];
  return profileRows?.[0] ?? null;
}

async function graphJson(
  method: string,
  url: string,
  token: string,
  body?: Record<string, unknown>,
) {
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: r.ok, status: r.status, json };
}

async function assertGroupsEligible(p: ProfileConfigRow) {
  if (!p.whatsapp_access_token || !p.whatsapp_phone_number_id) {
    return {
      ok: false as const,
      code: "WHATSAPP_GROUP_NOT_ELIGIBLE",
      message: "Sua conta não possui o WhatsApp Cloud API configurado no perfil.",
    };
  }
  const ver = graphVersion(p.meta_graph_version);
  const phoneId = p.whatsapp_phone_number_id;
  const token = p.whatsapp_access_token;

  const phone = await graphJson(
    "GET",
    `https://graph.facebook.com/${ver}/${phoneId}?fields=is_official_business_account,is_on_biz_app,platform_type`,
    token,
  );
  const phoneData = phone.json;
  if (phoneData.is_on_biz_app === true) {
    return {
      ok: false as const,
      code: "WHATSAPP_GROUP_NOT_ELIGIBLE",
      message:
        "Grupos não estão disponíveis para números da WhatsApp Business app. Use um número Cloud API com Official Business Account (OBA).",
    };
  }

  const oba = await graphJson(
    "GET",
    `https://graph.facebook.com/${ver}/${phoneId}/official_business_account?fields=oba_status,status_message`,
    token,
  );
  const obaStatus = String(oba.json.oba_status || "").toUpperCase();
  const isOba =
    phoneData.is_official_business_account === true || obaStatus === "APPROVED";
  if (!isOba) {
    return {
      ok: false as const,
      code: "WHATSAPP_GROUP_NOT_ELIGIBLE",
      message:
        "A Groups API exige Official Business Account (OBA) aprovado neste número. Solicite o OBA em Configurações.",
    };
  }

  return {
    ok: true as const,
    phoneId,
    token,
    ver,
    obaStatus: obaStatus || (phoneData.is_official_business_account ? "APPROVED" : ""),
  };
}

async function fetchInviteLink(groupId: string, token: string, ver: string) {
  const res = await graphJson(
    "GET",
    `https://graph.facebook.com/${ver}/${encodeURIComponent(groupId)}/invite_link`,
    token,
  );
  const link = res.json.invite_link;
  return typeof link === "string" ? link : null;
}

export const getGroupsEligibility = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (process.env.WHATSAPP_GROUPS_ENABLED === "false") {
      return { enabled: false, eligible: false, reason: "Módulo desativado nesta instalação." };
    }
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const p = await loadProfile(effectiveUserId);
    if (!p?.whatsapp_access_token || !p.whatsapp_phone_number_id) {
      return {
        enabled: true,
        eligible: false,
        reason: "WhatsApp Cloud API não configurado no perfil.",
      };
    }
    const check = await assertGroupsEligible(p);
    if (!check.ok) {
      return { enabled: true, eligible: false, reason: check.message, code: check.code };
    }
    return { enabled: true, eligible: true, obaStatus: check.obaStatus };
  });

export const createWhatsAppGroup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1, "Nome do grupo é obrigatório").max(128),
        description: z.string().trim().max(2048).optional(),
        join_approval_mode: z.enum(["auto_approve", "approval_required"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const p = await loadProfile(effectiveUserId);

    if (!p) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_NOT_ELIGIBLE",
          message: "Sua conta não possui o WhatsApp Cloud API configurado no perfil.",
        },
      };
    }

    const eligibility = await assertGroupsEligible(p);
    if (!eligibility.ok) {
      return { success: false, error: { code: eligibility.code, message: eligibility.message } };
    }

    const countRows = (await db.query(
      "SELECT COUNT(*) AS total FROM whatsapp_groups WHERE user_id = ? AND instance_id = ? AND status = 'active'",
      [effectiveUserId, eligibility.phoneId],
    )) as Array<{ total: number }>;
    if (Number(countRows?.[0]?.total || 0) >= 10000) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_LIMIT",
          message: "Limite de 10.000 grupos ativos por número de negócio.",
        },
      };
    }

    try {
      const created = await graphJson(
        "POST",
        `https://graph.facebook.com/${eligibility.ver}/${eligibility.phoneId}/groups`,
        eligibility.token,
        {
          messaging_product: "whatsapp",
          subject: data.name.trim(),
          ...(data.description ? { description: data.description } : {}),
          join_approval_mode: data.join_approval_mode || "auto_approve",
        },
      );

      if (!created.ok) {
        return {
          success: false,
          error: {
            code: "WHATSAPP_GROUP_CREATE_FAILED",
            message: parseGraphError(created.json, "A Meta recusou a criação do grupo."),
          },
        };
      }

      const groupId = extractCreatedGroupId(created.json);
      if (!groupId) {
        return {
          success: false,
          error: {
            code: "WHATSAPP_GROUP_CREATE_FAILED",
            message: "A Meta criou o grupo, mas não retornou o ID. Aguarde o webhook de ciclo de vida.",
          },
        };
      }

      let inviteLink = await fetchInviteLink(groupId, eligibility.token, eligibility.ver);
      if (!inviteLink && typeof created.json.invite_link === "string") {
        inviteLink = created.json.invite_link;
      }

      const groupRecordId = crypto.randomUUID();
      await db.query(
        `INSERT INTO whatsapp_groups (id, user_id, instance_id, group_id, name, description, invite_link, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          groupRecordId,
          effectiveUserId,
          eligibility.phoneId,
          groupId,
          data.name.trim(),
          data.description || null,
          inviteLink,
        ],
      );

      const contactId = crypto.randomUUID();
      await db.query(
        `INSERT INTO contacts (id, user_id, tenant_id, phone_e164, name, source, channel, chat_status, is_unread)
         VALUES (?, ?, ?, ?, ?, 'whatsapp_group', 'whatsapp_group', 'aberto', false)
         ON DUPLICATE KEY UPDATE name = VALUES(name), channel = 'whatsapp_group'`,
        [contactId, effectiveUserId, effectiveUserId, groupId, data.name.trim()],
      );

      return {
        success: true,
        data: {
          id: groupRecordId,
          group_id: groupId,
          name: data.name.trim(),
          invite_link: inviteLink,
          status: "active",
          pending_invite_webhook: !inviteLink,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_CREATE_FAILED",
          message: getErrorMessage(err, "Não foi possível criar o grupo no WhatsApp."),
        },
      };
    }
  });

export const syncWhatsAppGroupsFromMeta = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const p = await loadProfile(effectiveUserId);
    if (!p) {
      return { success: false, error: { message: "Perfil WhatsApp não configurado." } };
    }
    const eligibility = await assertGroupsEligible(p);
    if (!eligibility.ok) {
      return { success: false, error: { message: eligibility.message } };
    }

    const listed = await graphJson(
      "GET",
      `https://graph.facebook.com/${eligibility.ver}/${eligibility.phoneId}/groups?limit=100`,
      eligibility.token,
    );
    if (!listed.ok) {
      return {
        success: false,
        error: { message: parseGraphError(listed.json, "Falha ao listar grupos na Meta.") },
      };
    }

    const dataObj = listed.json.data as
      | { groups?: Array<{ id?: string; subject?: string; created_at?: string }> }
      | Array<{ id?: string; subject?: string }>
      | undefined;
    const groups = Array.isArray(dataObj)
      ? dataObj
      : Array.isArray(dataObj?.groups)
        ? dataObj.groups
        : [];

    let upserted = 0;
    for (const g of groups) {
      if (!g?.id) continue;
      const existing = (await db.query(
        "SELECT id FROM whatsapp_groups WHERE user_id = ? AND group_id = ? LIMIT 1",
        [effectiveUserId, g.id],
      )) as Array<{ id: string }>;
      if (existing[0]?.id) {
        await db.query(
          "UPDATE whatsapp_groups SET name = ?, status = 'active', instance_id = ? WHERE id = ? AND user_id = ?",
          [g.subject || "Grupo", eligibility.phoneId, existing[0].id, effectiveUserId],
        );
      } else {
        await db.query(
          `INSERT INTO whatsapp_groups (id, user_id, instance_id, group_id, name, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [crypto.randomUUID(), effectiveUserId, eligibility.phoneId, g.id, g.subject || "Grupo"],
        );
      }
      upserted += 1;
    }
    return { success: true, upserted };
  });

export const listWhatsAppGroups = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    let query = "SELECT * FROM whatsapp_groups WHERE user_id = ?";
    const params: SqlParams = [effectiveUserId];

    if (data?.status) {
      query += " AND status = ?";
      params.push(data.status);
    }
    if (data?.search) {
      query += " AND name LIKE ?";
      params.push(`%${data.search}%`);
    }

    query += " ORDER BY created_at DESC";

    const rows = (await db.query(query, params)) as WhatsAppGroupRow[];
    return { success: true, groups: rows };
  });

export const getWhatsAppGroupDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const groupRows = (await db.query(
      "SELECT * FROM whatsapp_groups WHERE id = ? AND user_id = ?",
      [data.id, effectiveUserId],
    )) as WhatsAppGroupRow[];

    const group = groupRows?.[0] ?? null;
    if (!group) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_NOT_FOUND",
          message: "Grupo não encontrado ou você não tem acesso.",
        },
      };
    }

    const participants = (await db.query(
      "SELECT * FROM whatsapp_group_participants WHERE group_id = ? AND user_id = ?",
      [group.group_id, effectiveUserId],
    )) as WhatsAppGroupParticipantRow[];

    const p = await loadProfile(effectiveUserId);
    let totalParticipants: number | null = null;
    let joinApprovalMode: string | null = null;
    let suspended: boolean | null = null;
    if (p?.whatsapp_access_token) {
      const ver = graphVersion(p.meta_graph_version);
      const info = await graphJson(
        "GET",
        `https://graph.facebook.com/${ver}/${encodeURIComponent(group.group_id)}?fields=subject,description,participants,join_approval_mode,total_participant_count,suspended,creation_timestamp`,
        p.whatsapp_access_token,
      );
      if (info.ok) {
        totalParticipants =
          typeof info.json.total_participant_count === "number"
            ? info.json.total_participant_count
            : null;
        joinApprovalMode =
          typeof info.json.join_approval_mode === "string" ? info.json.join_approval_mode : null;
        suspended = typeof info.json.suspended === "boolean" ? info.json.suspended : null;
      }
    }

    return {
      success: true,
      group,
      participants,
      totalParticipants,
      joinApprovalMode,
      suspended,
    };
  });

export const resetWhatsAppGroupInviteLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const groupRows = (await db.query(
      "SELECT * FROM whatsapp_groups WHERE id = ? AND user_id = ?",
      [data.id, effectiveUserId],
    )) as WhatsAppGroupRow[];
    const group = groupRows?.[0];
    if (!group) {
      return { success: false, error: { message: "Grupo não encontrado." } };
    }
    const p = await loadProfile(effectiveUserId);
    if (!p?.whatsapp_access_token) {
      return { success: false, error: { message: "Token Meta não configurado." } };
    }
    const ver = graphVersion(p.meta_graph_version);
    const reset = await graphJson(
      "POST",
      `https://graph.facebook.com/${ver}/${encodeURIComponent(group.group_id)}/invite_link`,
      p.whatsapp_access_token,
      { messaging_product: "whatsapp" },
    );
    if (!reset.ok) {
      return {
        success: false,
        error: { message: parseGraphError(reset.json, "Falha ao resetar o link de convite.") },
      };
    }
    const inviteLink = typeof reset.json.invite_link === "string" ? reset.json.invite_link : null;
    if (inviteLink) {
      await db.query(
        "UPDATE whatsapp_groups SET invite_link = ? WHERE id = ? AND user_id = ?",
        [inviteLink, group.id, effectiveUserId],
      );
    }
    return { success: true, invite_link: inviteLink };
  });

export const deleteWhatsAppGroup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const groupRows = (await db.query(
      "SELECT * FROM whatsapp_groups WHERE id = ? AND user_id = ?",
      [data.id, effectiveUserId],
    )) as WhatsAppGroupRow[];
    const group = groupRows?.[0];
    if (!group) {
      return { success: false, error: { message: "Grupo não encontrado." } };
    }
    const p = await loadProfile(effectiveUserId);
    if (!p?.whatsapp_access_token) {
      return { success: false, error: { message: "Token Meta não configurado." } };
    }
    const ver = graphVersion(p.meta_graph_version);
    const del = await graphJson(
      "DELETE",
      `https://graph.facebook.com/${ver}/${encodeURIComponent(group.group_id)}`,
      p.whatsapp_access_token,
    );
    if (!del.ok) {
      return {
        success: false,
        error: { message: parseGraphError(del.json, "A Meta recusou a exclusão do grupo.") },
      };
    }
    await db.query("UPDATE whatsapp_groups SET status = 'deleted' WHERE id = ? AND user_id = ?", [
      group.id,
      effectiveUserId,
    ]);
    await db.query(
      "UPDATE contacts SET is_archived = 1 WHERE user_id = ? AND phone_e164 = ? AND channel = 'whatsapp_group'",
      [effectiveUserId, group.group_id],
    );
    return { success: true };
  });

export const removeWhatsAppGroupParticipant = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z.object({ id: z.string().min(1), waId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const groupRows = (await db.query(
      "SELECT * FROM whatsapp_groups WHERE id = ? AND user_id = ?",
      [data.id, effectiveUserId],
    )) as WhatsAppGroupRow[];
    const group = groupRows?.[0];
    if (!group) return { success: false, error: { message: "Grupo não encontrado." } };
    const p = await loadProfile(effectiveUserId);
    if (!p?.whatsapp_access_token) {
      return { success: false, error: { message: "Token Meta não configurado." } };
    }
    const ver = graphVersion(p.meta_graph_version);
    const res = await graphJson(
      "DELETE",
      `https://graph.facebook.com/${ver}/${encodeURIComponent(group.group_id)}/participants`,
      p.whatsapp_access_token,
      {
        messaging_product: "whatsapp",
        participants: [{ user: data.waId }],
      },
    );
    if (!res.ok) {
      return {
        success: false,
        error: { message: parseGraphError(res.json, "Falha ao remover participante.") },
      };
    }
    await db.query(
      "UPDATE whatsapp_group_participants SET status = 'removed' WHERE user_id = ? AND group_id = ? AND wa_id = ?",
      [effectiveUserId, group.group_id, data.waId],
    );
    return { success: true };
  });

export const sendGroupInviteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        to: z.string().min(5),
        templateName: z.string().min(1),
        language: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const groupRows = (await db.query(
      "SELECT * FROM whatsapp_groups WHERE group_id = ? AND user_id = ?",
      [data.groupId, effectiveUserId],
    )) as WhatsAppGroupRow[];
    const group = groupRows?.[0];
    if (!group?.instance_id) {
      return { success: false, error: { message: "Grupo não encontrado." } };
    }
    const p = await loadProfile(effectiveUserId);
    if (!p?.whatsapp_access_token) {
      return { success: false, error: { message: "Token Meta não configurado." } };
    }
    const ver = graphVersion(p.meta_graph_version);
    const res = await graphJson(
      "POST",
      `https://graph.facebook.com/${ver}/${group.instance_id}/messages`,
      p.whatsapp_access_token,
      {
        messaging_product: "whatsapp",
        to: data.to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: data.templateName,
          language: { code: data.language || "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [{ type: "group_id", group_id: group.group_id }],
            },
          ],
        },
      },
    );
    if (!res.ok) {
      return {
        success: false,
        error: { message: parseGraphError(res.json, "Falha ao enviar convite por template.") },
      };
    }
    return { success: true };
  });

export const sendGroupMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        body: z.string().trim().optional(),
        type: z.enum(["text", "image", "audio", "video", "document", "sticker"]).optional(),
        text: z.object({ body: z.string() }).optional(),
        image: z
          .object({ id: z.string().optional(), link: z.string().optional(), caption: z.string().optional() })
          .optional(),
        audio: z.object({ id: z.string().optional(), link: z.string().optional() }).optional(),
        video: z
          .object({ id: z.string().optional(), link: z.string().optional(), caption: z.string().optional() })
          .optional(),
        document: z
          .object({
            id: z.string().optional(),
            link: z.string().optional(),
            filename: z.string().optional(),
          })
          .optional(),
        sticker: z.object({ id: z.string().optional(), link: z.string().optional() }).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const groupRows = (await db.query(
      "SELECT * FROM whatsapp_groups WHERE group_id = ? AND user_id = ?",
      [data.groupId, effectiveUserId],
    )) as WhatsAppGroupRow[];
    const group = groupRows?.[0] ?? null;

    if (!group) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_NOT_FOUND",
          message: "Grupo não cadastrado na plataforma.",
        },
      };
    }

    if (!group.instance_id) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_MESSAGE_SEND_FAILED",
          message: "Este grupo ainda não possui uma instância WhatsApp válida para envio.",
        },
      };
    }

    const { data: p } = await dbAdmin
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (!p || !p.whatsapp_access_token) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_MESSAGE_SEND_FAILED",
          message: "Conexão com a Meta não configurada.",
        },
      };
    }

    const msgType = data.type || "text";
    const bodyText = data.text?.body || data.body || "";
    if (msgType === "text" && !bodyText.trim()) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_MESSAGE_SEND_FAILED",
          message: "Corpo da mensagem é obrigatório.",
        },
      };
    }

    try {
      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "group",
        to: group.group_id,
        type: msgType,
      };
      if (msgType === "text") {
        payload.text = { preview_url: false, body: bodyText };
      } else if (msgType === "image") payload.image = data.image;
      else if (msgType === "audio") payload.audio = data.audio;
      else if (msgType === "video") payload.video = data.video;
      else if (msgType === "document") payload.document = data.document;
      else if (msgType === "sticker") payload.sticker = data.sticker;

      const apiVersion = graphVersion(p.meta_graph_version);
      const r = await fetch(
        `https://graph.facebook.com/${apiVersion}/${group.instance_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${p.whatsapp_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      let providerMsgId = null;
      if (r.ok) {
        const resJson = await r.json();
        providerMsgId = normalizeWaMessageId(resJson?.messages?.[0]?.id) || null;
      } else {
        const errText = await r.text();
        throw new Error(errText);
      }

      const msgId = crypto.randomUUID();
      await db.query(
        `INSERT INTO direct_messages (id, tenant_id, user_id, contact_phone, direction, type, body, wa_message_id, status, channel, provider_message_id, provider_account_id, recipient_type, external_group_id)
         VALUES (?, ?, ?, ?, 'outgoing', ?, ?, ?, 'sent', 'whatsapp_group', ?, ?, 'group', ?)`,
        [
          msgId,
          effectiveUserId,
          effectiveUserId,
          group.group_id,
          msgType,
          msgType === "text" ? bodyText : bodyText || msgType,
          providerMsgId,
          providerMsgId,
          group.instance_id,
          group.group_id,
        ],
      );

      return { success: true, messageId: msgId };
    } catch (e: unknown) {
      return {
        success: false,
        error: {
          code: "WHATSAPP_GROUP_MESSAGE_SEND_FAILED",
          message: getErrorMessage(e, "Erro ao enviar mensagem para o grupo."),
        },
      };
    }
  });

export const archiveWhatsAppGroup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    assertGroupsEnabled();
    const { default: db } = await import("./db");
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const groups = (await db.query(
      "SELECT group_id FROM whatsapp_groups WHERE id = ? AND user_id = ? LIMIT 1",
      [data.id, effectiveUserId],
    )) as GroupIdRow[];
    const groupId = groups?.[0]?.group_id;

    await db.query("UPDATE whatsapp_groups SET status = 'archived' WHERE id = ? AND user_id = ?", [
      data.id,
      effectiveUserId,
    ]);

    if (groupId) {
      await db.query(
        "UPDATE contacts SET is_archived = 1 WHERE user_id = ? AND phone_e164 = ? AND channel = 'whatsapp_group'",
        [effectiveUserId, groupId],
      );
    }

    return { success: true };
  });
