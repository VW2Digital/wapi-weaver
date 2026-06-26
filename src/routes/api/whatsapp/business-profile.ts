import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { dbAdmin } from "@/integrations/mysql/client.server";
import {
  buildBusinessProfileUpdatePayload,
  getWhatsAppBusinessProfileFromMeta,
  logBusinessProfileAction,
  updateWhatsAppBusinessProfileOnMeta,
} from "@/lib/whatsapp-business-profile.service";
import { WHATSAPP_VERTICALS, normalizeWebsites } from "@/lib/whatsapp-business-profile.shared";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

function getAuthUserId(request: Request): { userId: string; role: string } {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7).trim();
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (!decoded?.sub) throw new Error("Unauthorized");
  return { userId: decoded.sub, role: decoded.role || "user" };
}

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

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/whatsapp/business-profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { userId } = getAuthUserId(request);
          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const effectiveUserId = await resolveEffectiveUserId(userId);

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
            .eq("id", effectiveUserId)
            .maybeSingle();
          if (profErr) throw new Error(profErr.message);
          const { phoneNumberId, accessToken, apiVersion } = pickMetaCredentials(p);

          const profile = await getWhatsAppBusinessProfileFromMeta({
            phoneNumberId,
            accessToken,
            apiVersion,
          });
          await logBusinessProfileAction({
            userId,
            phoneNumberId,
            action: "fetch_profile",
            newData: profile,
            metaResponse: { ok: true },
            success: true,
          });
          return json({ success: true, data: profile }, 200);
        } catch (e: any) {
          return json(
            { success: false, message: e?.message || "Falha ao buscar perfil empresarial." },
            e?.message === "Unauthorized" ? 401 : 400,
          );
        }
      },

      PUT: async ({ request }) => {
        try {
          const { userId } = getAuthUserId(request);
          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const effectiveUserId = await resolveEffectiveUserId(userId);

          const body = updateSchema.parse(await request.json());

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
            .eq("id", effectiveUserId)
            .maybeSingle();
          if (profErr) throw new Error(profErr.message);
          const { phoneNumberId, accessToken, apiVersion } = pickMetaCredentials(p);

          const oldProfile = await getWhatsAppBusinessProfileFromMeta({
            phoneNumberId,
            accessToken,
            apiVersion,
          }).catch(() => null);

          const payload = buildBusinessProfileUpdatePayload({
            about: body.about,
            address: body.address,
            description: body.description,
            email: body.email,
            websites: normalizeWebsites(body.websites),
            vertical: body.vertical,
            profile_picture_handle: body.profile_picture_handle,
          } as any);

          const keys = Object.keys(payload).filter((k) => k !== "messaging_product");
          if (keys.length === 0) {
            return json({ success: true, message: "Nada a atualizar.", data: oldProfile }, 200);
          }

          const metaResp = await updateWhatsAppBusinessProfileOnMeta({
            phoneNumberId,
            accessToken,
            apiVersion,
            payload,
          });
          const newProfile = await getWhatsAppBusinessProfileFromMeta({
            phoneNumberId,
            accessToken,
            apiVersion,
          });

          await logBusinessProfileAction({
            userId,
            phoneNumberId,
            action: payload.profile_picture_handle ? "update_profile_picture" : "update_profile",
            oldData: oldProfile,
            newData: newProfile,
            metaResponse: metaResp,
            success: true,
          });

          return json(
            {
              success: true,
              message: "Perfil empresarial atualizado com sucesso.",
              data: newProfile,
            },
            200,
          );
        } catch (e: any) {
          return json(
            { success: false, message: e?.message || "Falha ao atualizar perfil empresarial." },
            e?.message === "Unauthorized" ? 401 : 400,
          );
        }
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        }),
    },
  },
});
