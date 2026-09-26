import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import {
  buildBusinessProfileUpdatePayload,
  getWhatsAppBusinessProfileFromMeta,
  logBusinessProfileAction,
  updateWhatsAppBusinessProfileOnMeta,
} from "@/lib/whatsapp-business-profile.service";
import {
  WHATSAPP_VERTICALS,
  normalizeBusinessProfile,
  normalizeWebsites,
} from "@/lib/whatsapp-business-profile.shared";
import db from "./db";
import { decryptMetaCredential } from "./encryption";

function pickMetaCredentials(p: any) {
  const phoneNumberId = (process.env.META_PHONE_NUMBER_ID || p?.whatsapp_phone_number_id || "")
    .toString()
    .trim();
  const accessToken = (process.env.META_ACCESS_TOKEN || p?.whatsapp_access_token || "")
    .toString()
    .trim();
  const apiVersion = (process.env.META_GRAPH_API_VERSION || p?.meta_graph_version || "v25.0")
    .toString()
    .trim();
  if (!phoneNumberId || !accessToken) {
    throw new Error("Credenciais da Meta não configuradas (Phone Number ID / Access Token).");
  }
  return { phoneNumberId, accessToken, apiVersion };
}

const verticalSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? "" : v))
  .refine(
    (v) => v === undefined || v === "" || (WHATSAPP_VERTICALS as readonly string[]).includes(v),
    {
      message: "Categoria (vertical) inválida.",
    },
  );

const updateSchema = z.object({
  about: z.string().trim().max(139).optional(),
  address: z.string().trim().max(256).optional(),
  description: z.string().trim().max(512).optional(),
  email: z.string().trim().max(128).email("E-mail inválido").optional().or(z.literal("")),
  websites: z
    .array(z.string().trim().max(256))
    .max(2, "A Meta permite no máximo 2 sites.")
    .optional()
    .refine(
      (arr) => !arr || arr.every((u) => !u || u.startsWith("https://") || u.startsWith("http://")),
      { message: "Sites devem começar com http:// ou https://." },
    ),
  vertical: verticalSchema,
  profile_picture_handle: z.string().trim().optional(),
});

export const getWhatsAppBusinessProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const rows: any = await db.query(
      "SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version FROM profiles WHERE id = ? LIMIT 1",
      [effectiveUserId],
    );
    const p = rows?.[0];

    const { phoneNumberId, accessToken, apiVersion } = pickMetaCredentials(p);

    try {
      const profile = await getWhatsAppBusinessProfileFromMeta({
        phoneNumberId,
        accessToken,
        apiVersion,
      });
      await logBusinessProfileAction({
        userId: context.userId,
        phoneNumberId,
        action: "fetch_profile",
        newData: profile,
        metaResponse: { ok: true },
        success: true,
      });
      return { success: true, data: profile };
    } catch (e: any) {
      await logBusinessProfileAction({
        userId: context.userId,
        phoneNumberId,
        action: "fetch_profile",
        metaResponse: { ok: false, error: e?.message },
        success: false,
        errorMessage: e?.message,
      });
      return { success: false, message: e?.message || "Falha ao buscar perfil empresarial." };
    }
  });

export const updateWhatsAppBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => updateSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const rows: any = await db.query(
      "SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version FROM profiles WHERE id = ? LIMIT 1",
      [effectiveUserId],
    );
    const p = rows?.[0];

    const { phoneNumberId, accessToken, apiVersion } = pickMetaCredentials(p);

    // Antes: estado atual (para log)
    let oldProfile: any = null;
    try {
      oldProfile = await getWhatsAppBusinessProfileFromMeta({
        phoneNumberId,
        accessToken,
        apiVersion,
      });
    } catch {
      // best-effort
    }

    const payload = buildBusinessProfileUpdatePayload({
      about: data.about,
      address: data.address,
      description: data.description,
      email: data.email,
      websites: normalizeWebsites(data.websites),
      vertical: data.vertical,
      profile_picture_handle: data.profile_picture_handle,
    } as any);

    // Se nada mudou (apenas messaging_product), não faz POST
    const keys = Object.keys(payload).filter((k) => k !== "messaging_product");
    if (keys.length === 0) {
      return {
        success: true,
        message: "Nada a atualizar.",
        data: oldProfile ?? normalizeBusinessProfile({}),
      };
    }

    try {
      const resp = await updateWhatsAppBusinessProfileOnMeta({
        phoneNumberId,
        accessToken,
        apiVersion,
        payload,
      });

      // Depois: buscar novamente para refletir o que ficou salvo na Meta
      const newProfile = await getWhatsAppBusinessProfileFromMeta({
        phoneNumberId,
        accessToken,
        apiVersion,
      });

      await logBusinessProfileAction({
        userId: context.userId,
        phoneNumberId,
        action: payload.profile_picture_handle ? "update_profile_picture" : "update_profile",
        oldData: oldProfile,
        newData: newProfile,
        metaResponse: resp,
        success: true,
      });

      return {
        success: true,
        message: "Perfil empresarial atualizado com sucesso.",
        data: newProfile,
      };
    } catch (e: any) {
      await logBusinessProfileAction({
        userId: context.userId,
        phoneNumberId,
        action: payload.profile_picture_handle ? "update_profile_picture" : "update_profile",
        oldData: oldProfile,
        newData: payload,
        metaResponse: { ok: false, error: e?.message },
        success: false,
        errorMessage: e?.message,
      });
      return { success: false, message: e?.message || "Falha ao atualizar perfil empresarial." };
    }
  });

export const onboardWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        code: z.string(),
        waba_id: z.string().optional(),
        phone_number_id: z.string().optional(),
        is_coexistence: z.boolean().optional(),
        meta_app_connection_id: z.string(),
        customer_business_id: z.string().optional(),
        flow_finish_type: z.string().max(80).optional(),
        migration_type: z.enum(["new", "coexistence", "obo", "grant_only", "phone"]).optional(),
        registration_pin: z
          .string()
          .regex(/^\d{6}$/)
          .optional(),
        billing_mode: z.enum(["customer_payment", "shared_credit"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const connectionId = data.meta_app_connection_id;
    if (!connectionId) {
      throw new Error("META_APP_CONNECTION_NOT_RESOLVED: meta_app_connection_id é obrigatório.");
    }

    const roleRows = await db.query<Array<{ role: string }>>(
      "SELECT role FROM user_roles WHERE user_id = ?",
      [context.userId],
    );
    const masterUser = roleRows.some(
      ({ role }) => role === "admin_master" || role === "adminmaster",
    );
    const connRows = masterUser
      ? await db.query<
          {
            connection_id: string;
            app_id: string;
            app_secret_encrypted: string;
            graph_version: string;
          }[]
        >(
          "SELECT id AS connection_id, app_id, app_secret_encrypted, graph_version FROM meta_app_connections WHERE id = ? AND tenant_id = ? LIMIT 1",
          [connectionId, effectiveUserId],
        )
      : [];
    let conn:
      | {
          app_id: string;
          connection_id?: string;
          app_secret_encrypted?: string;
          app_secret_plain?: string;
          graph_version: string;
        }
      | undefined = connRows?.[0];

    if (!conn && connectionId !== "platform") {
      const sharedRows = await db.query<
        {
          connection_id: string;
          app_id: string;
          app_secret_encrypted: string;
          graph_version: string;
        }[]
      >(
        `SELECT mac.id AS connection_id, mac.app_id, mac.app_secret_encrypted, mac.graph_version
         FROM meta_app_connections mac
         JOIN user_roles ur
           ON ur.user_id = mac.tenant_id
          AND ur.role IN ('admin_master', 'adminmaster')
         WHERE mac.id = ?
           AND mac.app_id = '1783038629742610'
           AND mac.status = 'active'
         LIMIT 1`,
        [connectionId],
      );
      conn = sharedRows?.[0];
    }

    if (!conn && connectionId === "platform") {
      const platformRows = await db.query<
        { meta_app_id: string; meta_app_secret: string; meta_graph_version: string | null }[]
      >(
        `SELECT meta_app_id, meta_app_secret, meta_graph_version
         FROM platform_settings
         WHERE id = 1
         LIMIT 1`,
      );
      const platform = platformRows?.[0];
      if (platform?.meta_app_id && platform?.meta_app_secret) {
        conn = {
          app_id: platform.meta_app_id,
          connection_id: undefined,
          app_secret_plain: platform.meta_app_secret,
          graph_version: platform.meta_graph_version || "v26.0",
        };
      }
    }

    if (!conn) {
      throw new Error("Meta App Connection master não encontrada.");
    }

    const APP_ID = conn.app_id;
    const GRAPH_VERSION = conn.graph_version || "v26.0";
    let APP_SECRET = conn.app_secret_plain || "";
    if (!APP_SECRET) {
      try {
        APP_SECRET = decryptMetaCredential(conn.app_secret_encrypted || "");
      } catch (err) {
        throw new Error("Falha ao descriptografar o App Secret da Meta App Connection.");
      }
    }

    if (!APP_ID || !APP_SECRET) {
      throw new Error("App ID e App Secret da Meta App Connection estão incompletos.");
    }

    try {
      // 1. Trocar o "code" por um token de acesso do cliente
      const tokenUrl = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${data.code}`;
      const tokenResp = await fetch(tokenUrl);
      const tokenData = await tokenResp.json();

      if (!tokenResp.ok) {
        throw new Error(tokenData.error?.message || "Erro ao obter access token.");
      }

      const accessToken = tokenData.access_token;
      let wabaId = data.waba_id;
      let phoneNumberId = data.phone_number_id;
      const isCoexistence =
        Boolean(data.is_coexistence) || data.migration_type === "coexistence";

      if (!wabaId) {
        throw new Error("waba_id é obrigatório. O Embedded Signup não retornou a WABA.");
      }

      if (isCoexistence && !phoneNumberId) {
        const phonesResp = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,is_on_biz_app`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const phonesBody = await phonesResp.json().catch(() => ({}));
        const phones = Array.isArray(phonesBody?.data) ? phonesBody.data : [];
        const onBiz = phones.find((p: any) => p?.is_on_biz_app) || phones[0];
        if (onBiz?.id) phoneNumberId = String(onBiz.id);
      }

      // Cloud API nova: registra o número. Coexistência: a Meta já converteu a conta; não usar /register (SMS).
      if (phoneNumberId && !isCoexistence) {
        const registerUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/register`;
        const registerBody: Record<string, string> = { messaging_product: "whatsapp" };
        if (data.registration_pin) registerBody.pin = data.registration_pin;
        const registerResp = await fetch(registerUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(registerBody),
        });
        if (!registerResp.ok) {
          const err = await registerResp.json();
          throw new Error(err.error?.message || "Erro ao registrar o número.");
        }
      }

      const subscribeUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`;
      const subscribeResp = await fetch(subscribeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!subscribeResp.ok) {
        const err = await subscribeResp.json();
        throw new Error(err.error?.message || "Erro ao assinar webhooks.");
      }

      if (isCoexistence && phoneNumberId) {
        for (const syncType of ["smb_app_state_sync", "history"] as const) {
          const syncResp = await fetch(
            `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/smb_app_data`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                sync_type: syncType,
              }),
            },
          );
          if (!syncResp.ok) {
            const err = await syncResp.json().catch(() => ({}));
            console.warn(
              `[CoEx] smb_app_data ${syncType} falhou:`,
              err?.error?.message || syncResp.status,
            );
          }
        }
      }

      // 5. Salvar no banco
      await db.query(
        `UPDATE profiles SET 
          whatsapp_access_token = ?, 
          whatsapp_phone_number_id = COALESCE(?, whatsapp_phone_number_id),
          whatsapp_waba_id = ? 
        WHERE id = ?`,
        [accessToken, phoneNumberId, wabaId, effectiveUserId],
      );

      const { finalizeWhatsAppPartnerOnboarding } = await import("./whatsapp-partner.functions");
      const partner = await finalizeWhatsAppPartnerOnboarding({
        tenantId: context.tenantId,
        metaAppConnectionId: conn.connection_id || null,
        customerBusinessId: data.customer_business_id || null,
        wabaId,
        phoneNumberId: phoneNumberId || null,
        businessToken: accessToken,
        flowFinishType: data.flow_finish_type || null,
        migrationType: data.migration_type,
        billingMode: data.billing_mode || "customer_payment",
      });

      return {
        success: true,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        requires_phone_selection: !phoneNumberId,
        partner,
      };
    } catch (e: any) {
      console.error("Erro no onboardWhatsApp:", e.message);
      return { success: false, message: e.message || "Erro desconhecido no onboard." };
    }
  });
