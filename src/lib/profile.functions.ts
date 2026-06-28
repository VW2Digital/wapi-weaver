import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";
import crypto from "crypto";

const credSchema = z.object({
  whatsapp_phone_number_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_waba_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_phone: z.string().trim().max(32).nullable().optional(),
  whatsapp_access_token: z.string().trim().max(1024).nullable().optional(),
  whatsapp_app_secret: z.string().trim().max(256).nullable().optional(),
  whatsapp_app_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_verify_token: z.string().trim().max(128).nullable().optional(),
  rate_limit_per_second: z.number().int().min(1).max(80).optional(),
  meta_graph_version: z
    .string()
    .trim()
    .regex(/^v\d+\.\d+$/, "Formato v20.0")
    .max(10)
    .optional(),
  display_name: z.string().trim().max(100).nullable().optional(),
  full_name: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  avatar_url: z.string().trim().max(500).nullable().optional(),
  company_name: z.string().trim().max(150).nullable().optional(),
  company_document: z.string().trim().max(32).nullable().optional(),
  company_website: z.string().trim().max(255).nullable().optional(),
  company_address: z.string().trim().max(500).nullable().optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    // Garante que sempre retorne ao menos o id, mesmo sem profile row
    return data ?? { id: context.userId };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("profiles").update(data).eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const rotateApiKey = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const newKey = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await context.db
      .from("profiles")
      .update({ api_key: newKey })
      .eq("id", context.userId);
    if (error) throw error;
    return { api_key: newKey };
  });

export const pingMeta = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,display_phone_number,verified_name,status,quality_rating,country_code,country_dial_code,code_verification_status,name_status,messaging_limit_tier,account_mode,is_official_business_account,platform_type";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao consultar Meta" };
    return { ok: true, info: body };
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        to: z.string().trim().min(5).max(40),
        text: z.string().trim().min(1).max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const isInstagram = data.to.startsWith("ig_");
    if (isInstagram) {
      return { ok: false, error: "Teste de envio não suportado para Instagram. Use o chat para testar." };
    }
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const digits = data.to.replace(/\D+/g, "");
    if (digits.length < 8) return { ok: false, error: "Número inválido" };

    const payload = buildWhatsAppPayload("text", digits, {
      text: data.text ?? "Mensagem de teste ✅",
    });

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const body = await r.json();
    if (!r.ok) {
      return { ok: false, error: body?.error?.message ?? "Falha ao enviar", details: body };
    }
    return { ok: true, wa_message_id: body?.messages?.[0]?.id, sent_to: digits };
  });

/**
 * Envia o template pré-aprovado `hello_world` (en_US) que a Meta disponibiliza
 * para todas as contas WhatsApp Business. Útil para validar entrega real
 * sem depender da janela de 24h.
 */
export const sendHelloWorldTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ to: z.string().trim().min(5).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.to.startsWith("ig_")) {
      return { ok: false, error: "Hello World não suportado para Instagram. Use o chat para testar." };
    }
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const digits = data.to.replace(/\D+/g, "");
    if (digits.length < 8) return { ok: false, error: "Número inválido" };

    const payload = buildWhatsAppPayload("template", digits, {
      template_name: "hello_world",
      language: "en_US",
    });

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const body = await r.json();
    if (!r.ok) {
      return { ok: false, error: body?.error?.message ?? "Falha ao enviar", details: body };
    }
    return { ok: true, wa_message_id: body?.messages?.[0]?.id, sent_to: digits };
  });

/**
 * Procura nos webhook_events recentes status updates para o wamid fornecido.
 * Retorna o status mais avançado encontrado (sent < delivered < read; failed sempre prevalece).
 */
export const getTestMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ wamid: z.string().trim().min(5).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    // SECURITY: o wamid precisa pertencer ao usuário autenticado antes de varrermos webhook_events.
    const { data: owned } = await dbAdmin
      .from("campaign_messages")
      .select("id")
      .eq("user_id", context.userId)
      .eq("wa_message_id", data.wamid)
      .maybeSingle();
    if (!owned) return { found: false as const };

    const { data: events } = await dbAdmin
      .from("webhook_events")
      .select("raw, received_at")
      .eq("user_id", context.userId)
      .order("received_at", { ascending: false })
      .limit(200);

    const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
    let best: { status: string; timestamp?: string; error?: any } | null = null;

    for (const ev of events ?? []) {
      const raw: any = ev.raw;
      const entries = raw?.entry ?? [];
      for (const entry of entries) {
        for (const change of entry?.changes ?? []) {
          const statuses = change?.value?.statuses ?? [];
          for (const s of statuses) {
            if (s?.id !== data.wamid) continue;
            const status = s.status as string;
            const ts = s.timestamp
              ? new Date(Number(s.timestamp) * 1000).toISOString()
              : ev.received_at;
            if (status === "failed") {
              return { found: true, status: "failed", timestamp: ts, error: s.errors ?? null };
            }
            if (!best || (rank[status] ?? 0) > (rank[best.status] ?? 0)) {
              best = { status, timestamp: ts };
            }
          }
        }
      }
    }

    return best ? { found: true, ...best } : { found: false };
  });

export const getQRCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/message_qrdls?fields=prefilled_message,deep_link_url,qr_image_url.format(PNG)&code=${encodeURIComponent(data.code)}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao consultar QR Code" };
    return { ok: true, data: body.data?.[0] ?? body };
  });

export const listQRCodes = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/message_qrdls?fields=code,prefilled_message,qr_image_url.format(PNG)`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao listar QR Codes" };
    return { ok: true, data: body.data || [] };
  });

export const createQRCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        prefilled_message: z.string().trim(),
        generate_qr_image: z.enum(["PNG", "SVG"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/message_qrdls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefilled_message: data.prefilled_message,
          generate_qr_image: data.generate_qr_image,
        }),
      },
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao criar QR Code" };
    return { ok: true, data: body };
  });

export const updateQRCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().trim().min(1),
        prefilled_message: z.string().trim(),
        generate_qr_image: z.enum(["PNG", "SVG"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const bodyPayload: any = {
      prefilled_message: data.prefilled_message,
      code: data.code,
    };
    if (data.generate_qr_image) {
      bodyPayload.generate_qr_image = data.generate_qr_image;
    }
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/message_qrdls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      },
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao editar QR Code" };
    return { ok: true, data: body };
  });

export const deleteQRCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/message_qrdls/${data.code}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao excluir QR Code" };
    return { ok: true, data: body };
  });

export const listOwnedWABAs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ businessId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,country,ownership_type,primary_business_location";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.businessId}/owned_whatsapp_business_accounts?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao listar WABAs próprias" };
    return { ok: true, data: body.data || [] };
  });

export const listClientWABAs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ businessId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,country,ownership_type,primary_business_location";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.businessId}/client_whatsapp_business_accounts?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao listar WABAs de clientes" };
    return { ok: true, data: body.data || [] };
  });

export const getWABAInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ wabaId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,country,ownership_type,primary_business_location";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.wabaId}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao consultar WABA" };
    return { ok: true, data: body };
  });

export const updateWABA = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        wabaId: z.string().trim().min(5),
        name: z.string().trim().optional(),
        timezone_id: z.string().trim().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const bodyPayload: any = {};
    if (data.name) bodyPayload.name = data.name;
    if (data.timezone_id) bodyPayload.timezone_id = data.timezone_id;

    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.wabaId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao atualizar WABA" };
    return { ok: true, data: body };
  });

export const subscribeAppToWABA = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ wabaId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao inscrever app na WABA" };
    return { ok: true, data: body };
  });

export const listWABAPhoneNumbers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ wabaId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,display_phone_number,verified_name,status,quality_rating,country_code,country_dial_code,code_verification_status,name_status,messaging_limit_tier,account_mode,is_official_business_account,platform_type";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.wabaId}/phone_numbers?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao listar telefones da WABA" };
    return { ok: true, data: body.data || [] };
  });

export const registerPhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        pin: z.string().trim().length(6, "O PIN deve ter exatamente 6 dígitos"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: data.pin,
      }),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao registrar número" };

    // Buscar detalhes do número na Meta
    let displayPhone = "";
    try {
      const detailsUrl = `https://graph.facebook.com/${apiVersion}/${data.phoneId}?fields=display_phone_number`;
      const dr = await fetch(detailsUrl, {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      });
      const dBody = await dr.json();
      if (dr.ok && dBody?.display_phone_number) {
        displayPhone = dBody.display_phone_number.replace(/\D/g, "");
      }
    } catch {
      // ignore
    }

    // Salvar o número como ativo no banco de dados local
    const { error: updateErr } = await context.db
      .from("profiles")
      .update({
        whatsapp_phone_number_id: data.phoneId,
        whatsapp_business_phone: displayPhone || null,
      })
      .eq("id", context.userId);

    if (updateErr) {
      return {
        ok: false,
        error: `Número registrado na Meta, mas erro ao salvar na tabela local: ${updateErr.message}`,
      };
    }

    return { ok: true, success: true, data: body };
  });

export const debugAccessToken = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ token: z.string().trim().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const apiVersion = "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${encodeURIComponent(data.token)}`,
      {
        headers: { Authorization: `Bearer ${data.token}` },
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao depurar token" };
    return { ok: true, data: body.data };
  });

export const listAssignedWABAs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ metaUserId: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,name,timezone_id,message_template_namespace,account_review_status,business_verification_status,country,ownership_type,primary_business_location";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.metaUserId}/assigned_whatsapp_business_accounts?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao listar WABAs atribuídas" };
    return { ok: true, data: body.data || [] };
  });

export const getWABABotDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ botId: z.string().trim().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.botId}?fields=id,prompts,commands,enable_welcome_message`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao obter detalhes do robô" };
    return { ok: true, data: body };
  });

export const checkCallPermissions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        recipientPhone: z.string().trim().min(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.phoneId}/call_permissions?user_wa_id=${encodeURIComponent(
        data.recipientPhone,
      )}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return {
        ok: false,
        error: body?.error?.message ?? "Falha ao verificar permissões de chamada",
      };
    return { ok: true, data: body };
  });

export const manageCall = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        action: z.enum(["connect", "accept", "reject", "terminate"]),
        to: z.string().trim().optional(),
        callId: z.string().trim().optional(),
        sdp: z.string().trim().optional(),
        sdpType: z.string().trim().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const payload: any = {
      messaging_product: "whatsapp",
      action: data.action,
    };
    if (data.to) payload.to = data.to;
    if (data.callId) payload.call_id = data.callId;
    if (data.sdp) payload.sdp = data.sdp;
    if (data.sdpType) payload.sdp_type = data.sdpType;

    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao gerenciar chamada" };
    return { ok: true, data: body };
  });

export const sendAdvancedSandboxMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        type: z.enum(["text", "marketing", "interactive"]),
        to: z.string().trim().min(5),
        payload: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const isMarketing = data.type === "marketing";
    const endpoint = isMarketing ? "marketing_messages" : "messages";

    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: data.to,
        ...data.payload,
      }),
    });

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao enviar mensagem de teste" };
    return { ok: true, data: body };
  });

export const uploadMetaMedia = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        fileName: z.string().trim().min(1),
        fileType: z.string().trim().min(1),
        fileBase64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";

    const binaryStr = atob(data.fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: data.fileType });

    const formData = new FormData();
    formData.append("file", blob, data.fileName);
    formData.append("messaging_product", "whatsapp");

    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
      },
      body: formData,
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao enviar mídia" };
    return { ok: true, data: body };
  });

export const requestVerificationCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        method: z.enum(["SMS", "VOICE", "IVR"]),
        language: z.string().trim().min(2),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/request_code`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code_method: data.method,
        language: data.language,
      }),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao solicitar código" };
    return { ok: true, data: body };
  });

export const verifyVerificationCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        code: z.string().trim().min(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/verify_code`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: data.code,
      }),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao verificar código" };
    return { ok: true, data: body };
  });

export const deregisterPhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/deregister`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
      },
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao desregistar número" };
    return { ok: true, data: body };
  });

export const getPhoneSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/settings`, {
      headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
    });

    const body = await r.json();
    if (!r.ok)
      return {
        ok: false,
        error: body?.error?.message ?? "Falha ao obter configurações de telefone",
      };
    return { ok: true, data: body };
  });

export const updatePhoneSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        payload: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data.payload),
    });

    const body = await r.json();
    if (!r.ok)
      return {
        ok: false,
        error: body?.error?.message ?? "Falha ao atualizar configurações de telefone",
      };
    return { ok: true, data: body };
  });

export const getOBAStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.phoneId}/official_business_account?fields=oba_status,status_message`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao obter status OBA" };
    return { ok: true, data: body };
  });

export const applyForOBA = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        payload: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.phoneId}/official_business_account`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data.payload),
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao solicitar OBA" };
    return { ok: true, data: body };
  });

export const getSinglePhoneInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "display_phone_number,verified_name,quality_rating,name_status,code_verification_status";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.phoneId}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao obter dados do telefone" };
    return { ok: true, data: body };
  });

export const updatePhoneConfig = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        payload: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data.payload),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao atualizar telefone" };
    return { ok: true, data: body };
  });

export const getSolutionDetails = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields = "id,name,status,status_for_pending_request,owner_app,owner_permissions";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.solutionId}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return { ok: false, error: body?.error?.message ?? "Falha ao obter detalhes da solução" };
    return { ok: true, data: body };
  });

export const acceptSolutionInvitation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.solutionId}/accept`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
      },
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao aceitar convite" };
    return { ok: true, data: body };
  });

export const rejectSolutionInvitation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.solutionId}/reject`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
      },
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao rejeitar convite" };
    return { ok: true, data: body };
  });

export const sendSolutionDeactivation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.solutionId}/send_deactivation_request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
        },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return {
        ok: false,
        error: body?.error?.message ?? "Falha ao enviar solicitação de desativação",
      };
    return { ok: true, data: body };
  });

export const acceptSolutionDeactivation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields = "id,name,status,status_for_pending_request,owner_permissions";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.solutionId}/accept_deactivation_request?fields=${fields}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
        },
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao aceitar desativação" };
    return { ok: true, data: body };
  });

export const rejectSolutionDeactivation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields = "id,name,status,status_for_pending_request,owner_permissions";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.solutionId}/reject_deactivation_request?fields=${fields}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
        },
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao rejeitar desativação" };
    return { ok: true, data: body };
  });

export const getSolutionAccessToken = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        solutionId: z.string().trim().min(5),
        businessId: z.string().trim().min(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.solutionId}/access_token?business_id=${encodeURIComponent(
        data.businessId,
      )}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const body = await r.json();
    if (!r.ok)
      return {
        ok: false,
        error: body?.error?.message ?? "Falha ao obter token de acesso da solução",
      };
    return { ok: true, data: body };
  });

export const listInstagramAccounts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const rows = await db.query(
      "SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY created_at DESC",
      [context.userId],
    );
    return rows;
  });

export const connectInstagramAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({
        ig_user_id: z.string().trim().min(5),
        username: z.string().trim().min(1),
        access_token: z.string().trim().min(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, access_token, status)
       VALUES (?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE username = VALUES(username), access_token = VALUES(access_token), status = 'active'`,
      [id, context.userId, data.ig_user_id, data.username, data.access_token],
    );
    return { ok: true };
  });

export const disconnectInstagramAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM instagram_accounts WHERE id = ? AND user_id = ?", [
      data.id,
      context.userId,
    ]);
    return { ok: true };
  });
