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
  email: z.string().trim().email("E-mail inválido").max(128).optional(),
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
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .maybeSingle();

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
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .maybeSingle();

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
