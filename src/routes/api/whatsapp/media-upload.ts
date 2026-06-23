import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

function getAuthUserId(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7).trim();
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
          const form = await request.formData();
          const phoneId = String(form.get("phoneId") || "").trim();
          const file = form.get("file");

          if (!phoneId || !(file instanceof File)) {
            return json({ ok: false, error: "Envie phoneId e file no multipart/form-data." }, 400);
          }

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_access_token, meta_graph_version")
            .eq("id", userId)
            .maybeSingle();

          if (profErr) {
            return json({ ok: false, error: profErr.message }, 400);
          }

          if (!p?.whatsapp_access_token) {
            return json({ ok: false, error: "Access Token não configurado." }, 400);
          }

          const apiVersion = p.meta_graph_version || "v20.0";
          const metaForm = new FormData();
          metaForm.append("file", file, file.name);
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
            return json({ ok: false, error: body?.error?.message ?? "Falha ao enviar mídia" }, r.status || 400);
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
