import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { JWT_SECRET } from "@/lib/jwt-secret";

function getAuthUserId(request: Request): string {
  let token = "";
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:wapi_token|app-token)=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1].trim());
    }
  }
  if (!token) {
    throw new Error("Unauthorized");
  }
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (!decoded?.sub) throw new Error("Unauthorized");
  return decoded.sub;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/whatsapp/media-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = getAuthUserId(request);
          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const effectiveUserId = await resolveEffectiveUserId(userId);

          const form = await request.formData();
          const phoneId = String(form.get("phoneId") || "").trim();
          const file = form.get("file");

          if (!phoneId || !(file instanceof File)) {
            return json({ ok: false, error: "Envie phoneId e file no multipart/form-data." }, 400);
          }

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_access_token, meta_graph_version")
            .eq("id", effectiveUserId)
            .maybeSingle();

          if (profErr) {
            return json({ ok: false, error: profErr.message }, 400);
          }

          if (!p?.whatsapp_access_token) {
            return json({ ok: false, error: "Access Token não configurado." }, 400);
          }

          let apiVersion = p.meta_graph_version || process.env.META_GRAPH_VERSION || "v26.0";
          if (apiVersion.startsWith("v") && parseFloat(apiVersion.slice(1)) < 24.0) {
            apiVersion = "v26.0";
          }

          const fileBuffer = await file.arrayBuffer();
          const mimeType = file.type || "audio/ogg";
          const fileName = file.name || (mimeType.includes("ogg") ? "audio.ogg" : "audio.mp4");
          const fileBlob = new Blob([fileBuffer], { type: mimeType });

          const metaForm = new FormData();
          metaForm.append("file", fileBlob, fileName);
          metaForm.append("type", mimeType);
          metaForm.append("messaging_product", "whatsapp");

          const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}/media`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${p.whatsapp_access_token}`,
            },
            body: metaForm,
          });

          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            return json(
              { ok: false, error: body?.error?.message ?? "Falha ao enviar mídia" },
              r.status || 400,
            );
          }

          return json({ ok: true, data: body }, 200);
        } catch (e: any) {
          return json(
            { ok: false, error: e?.message || "Falha no upload da mídia." },
            e?.message === "Unauthorized" ? 401 : 500,
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
