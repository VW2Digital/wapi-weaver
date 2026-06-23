import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { uploadProfilePictureToMeta, logBusinessProfileAction } from "@/lib/whatsapp-business-profile.service";

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
  const accessToken = (process.env.META_ACCESS_TOKEN || p?.whatsapp_access_token || "").toString().trim();
  const apiVersion = (process.env.META_GRAPH_API_VERSION || p?.meta_graph_version || "v25.0").toString().trim();
  const phoneNumberId = (process.env.META_PHONE_NUMBER_ID || p?.whatsapp_phone_number_id || "").toString().trim();
  if (!accessToken) throw new Error("Credenciais da Meta não configuradas (Access Token).");
  return { accessToken, apiVersion, phoneNumberId };
}

const MAX_BYTES = Number(process.env.META_PROFILE_PICTURE_MAX_BYTES || 5 * 1024 * 1024);
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png"]);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/whatsapp/business-profile/photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let phoneNumberIdForLog: string | null = null;
        try {
          const { userId } = getAuthUserId(request);
          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
            .eq("id", userId)
            .maybeSingle();
          if (profErr) throw new Error(profErr.message);
          const { accessToken, apiVersion, phoneNumberId } = pickMetaCredentials(p);
          phoneNumberIdForLog = phoneNumberId || null;

          const appId = String(process.env.META_APP_ID || "").trim();
          if (!appId) throw new Error("META_APP_ID não configurado no servidor.");

          const form = await request.formData();
          const file = form.get("profile_picture");
          if (!file || !(file instanceof File)) {
            return json(
              { success: false, message: "Envie o arquivo no campo profile_picture (multipart/form-data)." },
              400,
            );
          }

          if (!ALLOWED.has(file.type)) {
            return json({ success: false, message: "Formato inválido. Envie JPG ou PNG." }, 400);
          }
          if (file.size > MAX_BYTES) {
            return json(
              { success: false, message: `Imagem muito grande. Máximo ${Math.floor(MAX_BYTES / (1024 * 1024))}MB.` },
              400,
            );
          }

          const bytes = new Uint8Array(await file.arrayBuffer());
          const { handle, raw } = await uploadProfilePictureToMeta({
            appId,
            accessToken,
            apiVersion,
            filename: file.name || "profile_picture",
            mimeType: file.type,
            bytes,
          });

          await logBusinessProfileAction({
            userId,
            phoneNumberId: phoneNumberId || null,
            action: "upload_profile_picture",
            newData: { filename: file.name, mimeType: file.type, size: file.size, handle },
            metaResponse: raw,
            success: true,
          });

          return json({ success: true, profile_picture_handle: handle }, 200);
        } catch (e: any) {
          try {
            await logBusinessProfileAction({
              userId: null,
              phoneNumberId: phoneNumberIdForLog,
              action: "upload_profile_picture",
              metaResponse: { ok: false, error: e?.message },
              success: false,
              errorMessage: e?.message,
            });
          } catch {
            // ignore
          }
          return json(
            { success: false, message: e?.message || "Falha no upload da foto." },
            e?.message === "Unauthorized" ? 401 : 400,
          );
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        }),
    },
  },
});
