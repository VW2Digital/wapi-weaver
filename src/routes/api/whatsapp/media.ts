import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { resolveMediaContentType } from "@/lib/media-content-type";

function getAuthUserId(request: Request): string {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (!token) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:wapi_token|app-token|sb-access-token|token|sb-token)=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1].trim());
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

          // 1. Fetch user credentials from DB (using effectiveUserId)
          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const effectiveUserId = await resolveEffectiveUserId(userId);

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_access_token, whatsapp_phone_number_id, meta_graph_version")
            .eq("id", effectiveUserId)
            .maybeSingle();

          if (profErr || !p?.whatsapp_access_token) {
            return new Response("Unauthorized or WhatsApp credentials missing", { status: 401 });
          }

          const accessToken = p.whatsapp_access_token.trim();
          const phoneNumberId = p.whatsapp_phone_number_id?.trim() || "";
          let apiVersion = p.meta_graph_version || "v26.0";
          if (apiVersion.startsWith("v") && parseFloat(apiVersion.slice(1)) < 24.0) {
            apiVersion = "v26.0";
          }

          // 2. Query Meta to get download URL and mime type
          // Retrieve Media URL: https://graph.facebook.com/{{Version}}/{{Media-ID}}?phone_number_id=<PHONE_NUMBER_ID>
          const metaUrl = phoneNumberId
            ? `https://graph.facebook.com/${apiVersion}/${mediaId}?phone_number_id=${encodeURIComponent(phoneNumberId)}`
            : `https://graph.facebook.com/${apiVersion}/${mediaId}`;

          const metadataResponse = await fetch(metaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          const metaBody = await metadataResponse.json();
          if (!metadataResponse.ok || !metaBody?.url) {
            console.error("[Media Proxy API Error] Meta metadata fetch failed:", metaBody);
            return new Response(
              metaBody?.error?.message || "Failed to retrieve media information from Meta",
              { status: metadataResponse.status || 400 },
            );
          }

          let mediaDownloadUrl = metaBody.url;
          if (!mediaDownloadUrl.startsWith("http://") && !mediaDownloadUrl.startsWith("https://")) {
            mediaDownloadUrl = `https://graph.facebook.com/${apiVersion}/${mediaDownloadUrl.replace(/^\/+/, "")}`;
          }
          // 3. Download binary data from Meta
          // Download Media: https://graph.facebook.com/{{Version}}/{{Media-URL}}
          const downloadResponse = await fetch(mediaDownloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!downloadResponse.ok) {
            console.error("[Media Proxy API Error] Meta media download failed:", downloadResponse.status);
            return new Response("Failed to download media bytes from Meta", {
              status: downloadResponse.status || 500,
            });
          }

          const mediaBytes = new Uint8Array(await downloadResponse.arrayBuffer());
          const mimeType = resolveMediaContentType({
            fileName: metaBody.filename,
            declaredMimeType: metaBody.mime_type,
            upstreamContentType: downloadResponse.headers.get("content-type"),
            bytes: mediaBytes,
          });

          // 4. Return to client with correct mime type and headers
          const headers = new Headers();
          headers.set("Content-Type", mimeType);
          headers.set("Content-Length", String(mediaBytes.byteLength));
          headers.set("Accept-Ranges", "bytes");
          headers.set("Cache-Control", "public, max-age=86400, immutable");
          headers.set("X-Content-Type-Options", "nosniff");

          if (download) {
            const filename = metaBody.filename || `file-${mediaId}`;
            headers.set("Content-Disposition", `attachment; filename="${filename}"`);
          } else {
            headers.set("Content-Disposition", "inline");
          }

          return new Response(mediaBytes, {
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
