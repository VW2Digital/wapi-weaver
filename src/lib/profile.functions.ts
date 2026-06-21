import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";

const credSchema = z.object({
  whatsapp_phone_number_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_waba_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_phone: z.string().trim().max(32).nullable().optional(),
  whatsapp_access_token: z.string().trim().max(1024).nullable().optional(),
  whatsapp_app_secret: z.string().trim().max(256).nullable().optional(),
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
    return data;
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
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}?fields=display_phone_number,verified_name,quality_rating`,
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
        to: z.string().trim().min(8).max(20),
        text: z.string().trim().min(1).max(1000).optional(),
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
  .inputValidator((d) => z.object({ to: z.string().trim().min(8).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
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
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.businessId}/owned_whatsapp_business_accounts`,
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
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.businessId}/client_whatsapp_business_accounts`,
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
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.wabaId}`, {
      headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao consultar WABA" };
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
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.wabaId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
    });

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
    return { ok: true, data: body };
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
