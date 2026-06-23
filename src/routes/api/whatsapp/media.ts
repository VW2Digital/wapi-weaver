import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

function getAuthUserId(request: Request): string {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (!token) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  if (!token) throw new Error("Unauthorized");
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (!decoded?.sub) throw new Error("Unauthorized");
  return decoded.sub;
}

export const Route = createFileRoute("/api/whatsapp/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = getAuthUserId(request);
          const url = new URL(request.url);
          const mediaId = url.searchParams.get("id");
          const download = url.searchParams.get("download") === "1";

          if (!mediaId) {
            return new Response("Missing media id parameter", { status: 400 });
          }

          // 1. Fetch user credentials from DB
          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_access_token, meta_graph_version")
            .eq("id", userId)
            .maybeSingle();

          if (profErr || !p?.whatsapp_access_token) {
            return new Response("Unauthorized or WhatsApp credentials missing", { status: 401 });
          }

          const accessToken = p.whatsapp_access_token.trim();
          const apiVersion = p.meta_graph_version || "v20.0";

          // 2. Query Meta to get download URL and mime type
          const metaUrl = `https://graph.facebook.com/${apiVersion}/${mediaId}`;
          const metadataResponse = await fetch(metaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          const metaBody = await metadataResponse.json();
          if (!metadataResponse.ok || !metaBody?.url) {
            return new Response(
              metaBody?.error?.message || "Failed to retrieve media information from Meta",
              { status: metadataResponse.status },
            );
          }

          const mediaDownloadUrl = metaBody.url;
          const mimeType = metaBody.mime_type || "application/octet-stream";

          // 3. Download binary data from Meta
          const downloadResponse = await fetch(mediaDownloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!downloadResponse.ok) {
            return new Response("Failed to download media bytes from Meta", {
              status: downloadResponse.status,
            });
          }

          const blob = await downloadResponse.blob();

          // 4. Return to client with correct mime type and headers
          const headers = new Headers();
          headers.set("Content-Type", mimeType);
          headers.set("Content-Length", String(blob.size));

          if (download) {
            const filename = metaBody.filename || `file-${mediaId}`;
            headers.set("Content-Disposition", `attachment; filename="${filename}"`);
          } else {
            headers.set("Content-Disposition", "inline");
          }

          return new Response(blob, {
            status: 200,
            headers,
          });
        } catch (e: any) {
          console.error("[Media Proxy API Error]:", e.message);
          return new Response(e.message || "Internal Server Error", {
            status: e.message === "Unauthorized" ? 401 : 500,
          });
        }
      },
    },
  },
});
