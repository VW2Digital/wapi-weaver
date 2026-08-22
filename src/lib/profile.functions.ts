import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { buildWhatsAppPayload } from "@/lib/whatsapp-payload";
import crypto from "crypto";

export const PROFILE_MASKED_SECRET = "********";

function isMaskedProfileSecret(value: unknown) {
  return typeof value === "string" && /^[*•.\s]+$/.test(value.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringField(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
}

function getBooleanField(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function getMetaErrorMessage(body: unknown, fallback: string) {
  const bodyRecord = asRecord(body);
  const errorRecord = asRecord(bodyRecord?.error);
  return getStringField(errorRecord, "message") ?? fallback;
}

interface CoexistencePhoneInfo {
  id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  status: string | null;
  quality_rating: string | null;
  platform_type: string | null;
  is_on_biz_app: boolean | null;
}

function normalizeCoexistencePhoneInfo(body: unknown): CoexistencePhoneInfo {
  const record = asRecord(body);
  return {
    id: getStringField(record, "id") ?? null,
    display_phone_number: getStringField(record, "display_phone_number") ?? null,
    verified_name: getStringField(record, "verified_name") ?? null,
    status: getStringField(record, "status") ?? null,
    quality_rating: getStringField(record, "quality_rating") ?? null,
    platform_type: getStringField(record, "platform_type") ?? null,
    is_on_biz_app: getBooleanField(record, "is_on_biz_app") ?? null,
  };
}

const credSchema = z.object({
  full_name: z.string().trim().max(150).nullable().optional(),
  avatar_url: z.string().trim().max(1000).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  whatsapp_phone_number_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_waba_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_id: z.string().trim().max(64).nullable().optional(),
  whatsapp_business_phone: z.string().trim().max(32).nullable().optional(),
  whatsapp_access_token: z.string().trim().nullable().optional(),
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
  company_name: z.string().trim().max(150).nullable().optional(),
  company_document: z.string().trim().max(32).nullable().optional(),
  company_website: z.string().trim().max(255).nullable().optional(),
  company_address: z.string().trim().max(500).nullable().optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");

    // Garante que a row de profile existe (cria se não existir)
    await db.query(`INSERT IGNORE INTO profiles (id) VALUES (?)`, [context.userId]);

    const rows = (await db.query(
      `SELECT
         p.id, u.email, p.full_name, p.avatar_url, p.display_name, p.phone,
         p.company_name, p.company_document, p.company_address, p.company_website,
         p.rate_limit_per_second, p.whatsapp_verify_token, p.whatsapp_phone_number_id,
         p.whatsapp_waba_id, p.whatsapp_business_id, p.whatsapp_business_phone,
         p.whatsapp_app_id, p.meta_graph_version, p.salvy_api_key, p.api_key,
         p.created_at, p.updated_at,
         CASE WHEN p.whatsapp_access_token IS NOT NULL AND p.whatsapp_access_token <> ''
           THEN 1 ELSE 0 END AS hasAccessToken,
         CASE WHEN p.whatsapp_app_secret IS NOT NULL AND p.whatsapp_app_secret <> ''
           THEN 1 ELSE 0 END AS hasAppSecret
       FROM profiles p
       LEFT JOIN users u ON u.id = p.id
       WHERE p.id = ?
       LIMIT 1`,
      [context.userId],
    )) as any[];

    const data = rows?.[0] ?? null;
    return data
      ? {
          ...data,
          hasAccessToken: Boolean(data.hasAccessToken),
          hasAppSecret: Boolean(data.hasAppSecret),
          whatsapp_access_token: data.hasAccessToken ? PROFILE_MASKED_SECRET : "",
          whatsapp_app_secret: data.hasAppSecret ? PROFILE_MASKED_SECRET : "",
        }
      : { id: context.userId, hasAccessToken: false, hasAppSecret: false };
  });

export const revealWhatsAppAccessToken = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const rows = (await db.query(
      `SELECT whatsapp_access_token
       FROM profiles
       WHERE id = ?
       LIMIT 1`,
      [context.userId],
    )) as Array<{ whatsapp_access_token?: string | null }>;

    return {
      token: rows[0]?.whatsapp_access_token || "",
    };
  });

export const revealWhatsAppAppSecret = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const rows = (await db.query(
      `SELECT whatsapp_app_secret
       FROM profiles
       WHERE id = ?
       LIMIT 1`,
      [context.userId],
    )) as Array<{ whatsapp_app_secret?: string | null }>;

    return {
      secret: rows[0]?.whatsapp_app_secret || "",
    };
  });

/**
 * Remove somente a conexão Meta deste tenant. Dados operacionais (contatos,
 * conversas, campanhas e fluxos) permanecem intactos para que uma nova
 * conexão possa ser feita sem perda de histórico.
 */
export const disconnectMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    await db.query(
      `UPDATE profiles
       SET whatsapp_phone_number_id = NULL,
           whatsapp_waba_id = NULL,
           whatsapp_business_id = NULL,
           whatsapp_business_phone = NULL,
           whatsapp_access_token = NULL,
           whatsapp_app_secret = NULL,
           whatsapp_app_id = NULL,
           whatsapp_verify_token = NULL,
           meta_graph_version = 'v26.0'
       WHERE id = ?`,
      [context.userId],
    );

    return { ok: true as const };
  });


export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => credSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");

    // Construir dinamicamente apenas os campos enviados
    const fields = Object.entries(data).filter(
      ([key, value]) =>
        value !== undefined &&
        !(
          (key === "whatsapp_access_token" || key === "whatsapp_app_secret") &&
          isMaskedProfileSecret(value)
        ),
    );
    if (fields.length === 0) return { ok: true };

    const cols = fields.map(([k]) => `\`${k}\``).join(", ");
    const vals = fields.map(([, v]) => v);
    const placeholders = fields.map(() => "?").join(", ");
    const updates = fields.map(([k]) => `\`${k}\` = VALUES(\`${k}\`)`).join(", ");

    // UPSERT: garante que mesmo usuários sem row na tabela profiles terão seus dados salvos
    await db.query(
      `INSERT INTO profiles (id, ${cols}) VALUES (?, ${placeholders})
       ON DUPLICATE KEY UPDATE ${updates}`,
      [context.userId, ...vals],
    );

    // A configuração manual também precisa inscrever o aplicativo na WABA.
    // Sem este POST oficial, a Meta aceita o token para envios, mas não entrega
    // mensagens recebidas ao callback (e o bot nunca é acionado).
    const profileRows = (await db.query(
      `SELECT whatsapp_waba_id, whatsapp_access_token, whatsapp_app_id,
              whatsapp_app_secret, whatsapp_verify_token, meta_graph_version
       FROM profiles WHERE id = ? LIMIT 1`,
      [context.userId],
    )) as any[];
    const profile = profileRows?.[0];

    // Configura o objeto e o campo que efetivamente entregam mensagens ao
    // callback. Inscrever somente a WABA em /subscribed_apps não cria esta
    // assinatura no App Dashboard.
    if (
      profile?.whatsapp_app_id &&
      profile?.whatsapp_app_secret &&
      profile?.whatsapp_verify_token
    ) {
      const publicAppUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL;
      if (!publicAppUrl) {
        return {
          ok: true,
          warning: "Credenciais salvas, mas APP_URL não está configurada para registrar o webhook na Meta.",
        };
      }

      const apiVersion = profile.meta_graph_version || "v26.0";
      const callbackUrl = new URL("/api/public/whatsapp-webhook", publicAppUrl).toString();
      const appSubscriptionResponse = await fetch(
        `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_app_id}/subscriptions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            object: "whatsapp_business_account",
            callback_url: callbackUrl,
            fields: "messages",
            verify_token: profile.whatsapp_verify_token,
            access_token: `${profile.whatsapp_app_id}|${profile.whatsapp_app_secret}`,
          }),
        },
      );
      const appSubscriptionBody = await appSubscriptionResponse.json().catch(() => ({}));
      if (!appSubscriptionResponse.ok || appSubscriptionBody?.success !== true) {
        return {
          ok: true,
          warning:
            appSubscriptionBody?.error?.message ||
            "Credenciais salvas, mas a Meta recusou a configuração do campo messages.",
        };
      }
    }

    if (profile?.whatsapp_waba_id && profile?.whatsapp_access_token) {
      const apiVersion = profile.meta_graph_version || "v26.0";
      const subscriptionResponse = await fetch(
        `https://graph.facebook.com/${apiVersion}/${profile.whatsapp_waba_id}/subscribed_apps`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${profile.whatsapp_access_token}` },
        },
      );
      const subscriptionBody = await subscriptionResponse.json().catch(() => ({}));
      if (!subscriptionResponse.ok) {
        return {
          ok: true,
          warning:
            subscriptionBody?.error?.message ||
            "Credenciais salvas, mas a Meta recusou a inscrição do webhook.",
        };
      }
    }

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
      "id,display_phone_number,verified_name,status,quality_rating,country_code,country_dial_code,code_verification_status,name_status,messaging_limit_tier,account_mode,is_official_business_account,platform_type,is_on_biz_app";
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

async function requestSmbAppDataSync(
  accessToken: string,
  apiVersion: string,
  phoneId: string,
  syncType: "smb_app_state_sync" | "history",
) {
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}/smb_app_data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      sync_type: syncType,
    }),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    return {
      ok: false as const,
      error: getMetaErrorMessage(body, "Falha ao iniciar sincronização SMB App Data"),
    };
  }

  const bodyRecord = asRecord(body);
  return {
    ok: true as const,
    request_id: getStringField(bodyRecord, "request_id") ?? null,
  };
}

export const getCoexistencePhoneStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    const phoneId = data.phoneId || p?.whatsapp_phone_number_id;
    if (!phoneId || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields =
      "id,display_phone_number,verified_name,status,quality_rating,country_code,country_dial_code,code_verification_status,name_status,messaging_limit_tier,account_mode,is_official_business_account,platform_type,is_on_biz_app";
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneId}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );
    const body: unknown = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: getMetaErrorMessage(body, "Falha ao consultar status de coexistência"),
      };
    }

    return { ok: true, info: normalizeCoexistencePhoneInfo(body) };
  });

export const syncCoexistenceContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    return requestSmbAppDataSync(
      p.whatsapp_access_token,
      p.meta_graph_version || "v20.0",
      data.phoneId,
      "smb_app_state_sync",
    );
  });

export const syncCoexistenceHistory = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    return requestSmbAppDataSync(
      p.whatsapp_access_token,
      p.meta_graph_version || "v20.0",
      data.phoneId,
      "history",
    );
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
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
      return {
        ok: false,
        error: "Teste de envio não suportado para Instagram. Use o chat para testar.",
      };
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
  .validator((d) => z.object({ to: z.string().trim().min(5).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.to.startsWith("ig_")) {
      return {
        ok: false,
        error: "Hello World não suportado para Instagram. Use o chat para testar.",
      };
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
  .validator((d) => z.object({ wamid: z.string().trim().min(5).max(200) }).parse(d))
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
  .validator((d) => z.object({ code: z.string().trim().min(1) }).parse(d))
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
  .validator((d) =>
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
  .validator((d) =>
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
  .validator((d) => z.object({ code: z.string().trim().min(1) }).parse(d))
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
  .validator((d) => z.object({ businessId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ businessId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ wabaId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) =>
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
  .validator((d) => z.object({ wabaId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ wabaId: z.string().trim().min(5) }).parse(d))
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
      "id,display_phone_number,verified_name,status,quality_rating,country_code,country_dial_code,code_verification_status,name_status,messaging_limit_tier,account_mode,is_official_business_account,platform_type,is_on_biz_app";
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
  .validator((d) =>
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
  .validator((d) => z.object({ token: z.string().trim().min(10).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let token = data.token;
    if (!token) {
      const { data: profile } = await context.db
        .from("profiles")
        .select("whatsapp_access_token")
        .eq("id", context.userId)
        .maybeSingle();
      token = profile?.whatsapp_access_token ?? undefined;
    }
    if (!token) return { ok: false, error: "Access Token não configurado." };

    const apiVersion = "v20.0";
    const r = await fetch(
      `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${encodeURIComponent(token)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao depurar token" };
    return { ok: true, data: body.data };
  });

export const listAssignedWABAs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ metaUserId: z.string().trim().min(1) }).parse(d))
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
  .validator((d) => z.object({ botId: z.string().trim().min(1) }).parse(d))
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
  .validator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        recipientPhone: z.string().trim().min(5),
        waId: z.string().trim().optional(),
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

    const apiVersion = p.meta_graph_version || "v26.0";
    const cleanDigits = data.recipientPhone.replace(/\D/g, "");
    
    // Lista de candidatos de identificação do WhatsApp (inclui waId e variações do 9º dígito BR)
    const phoneCandidates = new Set<string>();
    if (data.waId) phoneCandidates.add(data.waId.replace(/\D/g, ""));
    if (cleanDigits) phoneCandidates.add(cleanDigits);

    // Variações para números do Brasil (DDI 55)
    if (cleanDigits.startsWith("55")) {
      if (cleanDigits.length === 13) {
        // Remove o 9 após o DDD (55 + 2 dígitos DDD + 9 + 8 dígitos) -> (55 + DDD + 8 dígitos)
        const withoutNine = cleanDigits.slice(0, 4) + cleanDigits.slice(5);
        phoneCandidates.add(withoutNine);
      } else if (cleanDigits.length === 12) {
        // Insere o 9 após o DDD (55 + 2 dígitos DDD + 8 dígitos) -> (55 + DDD + 9 + 8 dígitos)
        const withNine = cleanDigits.slice(0, 4) + "9" + cleanDigits.slice(4);
        phoneCandidates.add(withNine);
      }
    }

    let lastError = "Falha ao verificar permissões de chamada";
    let lastBody: any = null;

    for (const phoneCandidate of phoneCandidates) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/${apiVersion}/${data.phoneId}/call_permissions?user_wa_id=${encodeURIComponent(
            phoneCandidate,
          )}`,
          {
            headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
          },
        );

        const body = await r.json();
        lastBody = body;

        if (!r.ok) {
          lastError = body?.error?.message ?? lastError;
          continue;
        }

        const permData = body?.data?.[0];
        const status = String(permData?.status || body?.status || "").toLowerCase();
        const availableActions = permData?.available_actions || body?.available_actions || [];
        const hasStartCallAction = availableActions.some(
          (a: any) =>
            a.action === "start_call" && (a.can_perform_action === undefined || a.can_perform_action === true),
        );

        const isGranted =
          status === "granted" ||
          status === "temporary" ||
          status === "active" ||
          status === "approved" ||
          hasStartCallAction;

        if (isGranted) {
          return {
            ok: true,
            data: {
              is_granted: true,
              status,
              target_phone: phoneCandidate,
              available_actions: availableActions,
              raw: body,
            },
          };
        }
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }

    // Se nenhuma variação retornou status de permissão ativa, retorna o último resultado com is_granted: false
    return {
      ok: true,
      data: {
        is_granted: false,
        status: lastBody?.data?.[0]?.status || lastBody?.status || "no_permission",
        target_phone: cleanDigits,
        available_actions: lastBody?.data?.[0]?.available_actions || lastBody?.available_actions || [],
        raw: lastBody,
        error_message: lastError,
      },
    };
  });

export const sendCallPermissionRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        to: z.string().trim().min(5),
        message: z.string().optional(),
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

    const apiVersion = p.meta_graph_version || "v26.0";
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: data.to.replace(/\D/g, ""),
      type: "interactive",
      interactive: {
        type: "call_permission_request",
        body: {
          text:
            data.message ||
            "Gostaríamos de ligar para você para dar continuidade ao seu atendimento. Podemos ligar?",
        },
        action: {
          name: "call_permission_request",
        },
      },
    };

    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao enviar solicitação de permissão" };
    return { ok: true, data: body };
  });

export const checkCallingEligibility = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version, whatsapp_phone_number_id")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    if (!p?.whatsapp_phone_number_id) {
      return { ok: false, error: "Phone Number ID não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v26.0";
    
    // Verificar configurações atuais do número
    const settingsResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${data.phoneId}/settings`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const settingsBody = await settingsResponse.json();
    if (!settingsResponse.ok) {
      return {
        ok: false,
        error: settingsBody?.error?.message ?? "Falha ao obter configurações do número",
      };
    }

    // Verificar se Calling está habilitado
    const callingSettings = settingsBody?.calling || {};
    const isCallingEnabled = callingSettings.status === "ENABLED";
    
    // Verificar subscrição do webhook calls
    const subscriptionsResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/subscribed_apps`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );

    const subscriptionsBody = await subscriptionsResponse.json();
    let isCallsWebhookSubscribed = false;
    
    if (subscriptionsResponse.ok && subscriptionsBody?.data) {
      isCallsWebhookSubscribed = subscriptionsBody.data.some(
        (app: any) => app.subscribed_fields?.includes("calls")
      );
    }

    return {
      ok: true,
      data: {
        phone_number_id: p.whatsapp_phone_number_id,
        waba_id: p.whatsapp_waba_id,
        graph_api_version: apiVersion,
        calling_enabled: isCallingEnabled,
        calls_webhook_subscribed: isCallsWebhookSubscribed,
        call_settings: callingSettings,
      },
    };
  });

export const enableCallingAPI = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      return { ok: false, error: "Access Token não configurado." };
    }

    const apiVersion = p.meta_graph_version || "v26.0";
    
    const payload = {
      calling: {
        status: "ENABLED",
        call_icon_visibility: "DEFAULT",
        callback_permission_status: "ENABLED",
      },
    };

    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/settings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await r.json();
    if (!r.ok) {
      return { ok: false, error: body?.error?.message ?? "Falha ao habilitar Calling API" };
    }

    return { ok: true, data: body };
  });

export const manageCall = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        phoneId: z.string().trim().min(5),
        action: z.enum(["connect", "accept", "reject", "terminate", "pre_accept"]),
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

    const apiVersion = p.meta_graph_version || "v26.0";
    
    // Candidatos para o número de destino (incluindo variações de 9º dígito BR)
    const cleanTo = data.to ? data.to.replace(/\D/g, "") : "";
    const phoneCandidates: Array<string | undefined> = cleanTo ? [cleanTo] : [undefined];
    if (cleanTo && cleanTo.startsWith("55")) {
      if (cleanTo.length === 13) {
        phoneCandidates.push(cleanTo.slice(0, 4) + cleanTo.slice(5));
      } else if (cleanTo.length === 12) {
        phoneCandidates.push(cleanTo.slice(0, 4) + "9" + cleanTo.slice(4));
      }
    }

    let lastError = "Falha ao gerenciar chamada";
    let lastBody: any = null;

    for (const targetPhone of phoneCandidates) {
      const payload: any = {
        messaging_product: "whatsapp",
        action: data.action,
      };
      if (targetPhone) payload.to = targetPhone;
      if (data.callId) payload.call_id = data.callId;
      if (data.sdp) {
        payload.session = {
          sdp_type: data.sdpType || "offer",
          sdp: data.sdp,
        };
      }

      try {
        const r = await fetch(`https://graph.facebook.com/${apiVersion}/${data.phoneId}/calls`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${p.whatsapp_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const body = await r.json();
        lastBody = body;

        if (r.ok) {
          return { ok: true, data: body, targetPhone };
        }

        lastError = body?.error?.message ?? lastError;
      } catch (fetchErr: any) {
        lastError = fetchErr?.message || lastError;
      }
    }

    return { ok: false, error: lastError, data: lastBody };
  });

export const sendAdvancedSandboxMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
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
  .validator((d) =>
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
  .validator((d) =>
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
  .validator((d) =>
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
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) =>
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
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) =>
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
  .validator((d) => z.object({ phoneId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) =>
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
  .validator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) => z.object({ solutionId: z.string().trim().min(5) }).parse(d))
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
  .validator((d) =>
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
        app_id: z.string().optional(),
        app_secret: z.string().optional(),
        token_expires_at: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, access_token, app_id, app_secret, token_expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE username = VALUES(username), access_token = VALUES(access_token), app_id = VALUES(app_id), app_secret = VALUES(app_secret), token_expires_at = VALUES(token_expires_at), status = 'active'`,
      [
        id,
        context.userId,
        data.ig_user_id,
        data.username,
        data.access_token,
        data.app_id || null,
        data.app_secret || null,
        data.token_expires_at || null,
      ],
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

export const listFacebookPages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const rows = await db.query(
      "SELECT * FROM facebook_pages WHERE user_id = ? ORDER BY created_at DESC",
      [context.userId],
    );
    return rows;
  });

export const connectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) =>
    z
      .object({
        page_id: z.string().trim().min(5),
        page_name: z.string().trim().min(1),
        page_access_token: z.string().trim().min(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO facebook_pages (id, user_id, page_id, page_name, page_access_token, status, webhook_subscribed)
       VALUES (?, ?, ?, ?, ?, 'active', 1)
       ON DUPLICATE KEY UPDATE page_name = VALUES(page_name), page_access_token = VALUES(page_access_token), status = 'active', webhook_subscribed = 1`,
      [id, context.userId, data.page_id, data.page_name, data.page_access_token],
    );
    return { ok: true };
  });

export const disconnectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM facebook_pages WHERE id = ? AND user_id = ?", [
      data.id,
      context.userId,
    ]);
    return { ok: true };
  });
