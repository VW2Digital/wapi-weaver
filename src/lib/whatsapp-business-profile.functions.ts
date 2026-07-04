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
  .validator((d) => z.object({
    code: z.string(),
    waba_id: z.string().optional(),
    phone_number_id: z.string().optional(),
    is_coexistence: z.boolean().optional()
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const APP_ID = process.env.VITE_META_APP_ID || process.env.META_APP_ID;
    const APP_SECRET = process.env.META_APP_SECRET;
    const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v20.0";

    if (!APP_ID || !APP_SECRET) {
      throw new Error("META_APP_ID e META_APP_SECRET precisam estar configurados.");
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

      // 2. Tentar buscar os IDs se o frontend não enviou (usando token de debug ou chamada direta)
      // Nota: o ideal é o frontend enviar. Se não enviou e precisar, podemos chamar a Graph API.
      if (!wabaId || !phoneNumberId) {
        // Exemplo: debug_token para achar os accounts (se aplicável), mas o ideal é que venha do frontend.
        // O fluxo do frontend passará os IDs.
        if (!wabaId || !phoneNumberId) {
           throw new Error("waba_id e phone_number_id são obrigatórios. O frontend não os enviou.");
        }
      }

      // 3. Registrar o número para uso na Cloud API (coexistência ignora o registro, pois já está registrado)
      if (!data.is_coexistence) {
        const registerUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/register`;
        const registerResp = await fetch(registerUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ messaging_product: 'whatsapp' })
        });
        if (!registerResp.ok) {
          const err = await registerResp.json();
          throw new Error(err.error?.message || "Erro ao registrar o número.");
        }
      }

      // 4. Assinar seu app aos webhooks dessa WABA
      const subscribeUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`;
      const subscribeResp = await fetch(subscribeUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      });
      if (!subscribeResp.ok) {
        const err = await subscribeResp.json();
        throw new Error(err.error?.message || "Erro ao assinar webhooks.");
      }

      // 4.5. Se for coexistência, solicitar sincronização inicial (smb_app_data)
      if (data.is_coexistence) {
        const syncUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/smb_app_data`;
        const syncResp = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            history_sync: true, // Configuração base (você pode optar por history_sync: false se não quiser mensagens antigas)
            contacts_sync: true
          })
        });
        if (!syncResp.ok) {
          const err = await syncResp.json();
          console.warn("Falha ao iniciar sincronização de coexistência:", err.error?.message);
          // Não abortamos o onboarding se apenas a sincronização falhar.
        }
      }

      // 5. Salvar no banco
      await db.query(
        `UPDATE profiles SET 
          whatsapp_access_token = ?, 
          whatsapp_phone_number_id = ?, 
          whatsapp_waba_id = ? 
        WHERE id = ?`,
        [accessToken, phoneNumberId, wabaId, effectiveUserId]
      );

      return { success: true, waba_id: wabaId, phone_number_id: phoneNumberId };
    } catch (e: any) {
      console.error("Erro no onboardWhatsApp:", e.message);
      return { success: false, message: e.message || "Erro desconhecido no onboard." };
    }
  });
