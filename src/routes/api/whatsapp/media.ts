import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import path from "node:path";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { resolveMediaContentType } from "@/lib/media-content-type";
import db from "@/lib/db";
import { decryptMetaCredential } from "@/lib/encryption";
import { createUploadFileResponse } from "@/lib/upload-file-response.server";
import { resolveExistingUploadFile } from "@/lib/tenant-storage";

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

function firstRow<T>(result: unknown): T | null {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (Array.isArray(first)) return (first[0] as T) ?? null;
    return first as T;
  }
  return null;
}

function parseMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, any>) : {};
}

function storagePathFromMetadata(meta: Record<string, any>): string | null {
  if (typeof meta.local_file_path === "string" && meta.local_file_path.trim()) {
    return meta.local_file_path.trim().replace(/^\/?uploads\//, "");
  }
  const mediaUrl = typeof meta.media_url === "string" ? meta.media_url : "";
  if (mediaUrl.includes("/api/storage/file")) {
    try {
      const parsed = new URL(mediaUrl, "http://localhost");
      const p = parsed.searchParams.get("path");
      if (p) return p;
    } catch {
      return null;
    }
  }
  return null;
}

export const Route = createFileRoute("/api/whatsapp/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = getAuthUserId(request);
          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const tenantId = await resolveEffectiveUserId(userId);
          const url = new URL(request.url);
          const mediaId = url.searchParams.get("id");
          const messageId = url.searchParams.get("messageId");
          const download = url.searchParams.get("download") === "1";

          if (!mediaId) {
            return new Response("Missing media id parameter", { status: 400 });
          }

          if (!messageId) {
            return new Response("Missing messageId parameter", { status: 400 });
          }

          const rows = await db.query(
            `SELECT
               dm.id,
               dm.tenant_id,
               dm.user_id,
               dm.channel,
               dm.channel_connection_id,
               dm.raw_payload,
               dm.metadata
             FROM direct_messages dm
             WHERE (dm.id = ? OR dm.wa_message_id = ?)
               AND (dm.user_id = ? OR dm.tenant_id = ?)
             LIMIT 1`,
            [messageId, messageId, tenantId, tenantId],
          );

          const message = firstRow<{
            id: string;
            tenant_id: string;
            user_id: string;
            channel: string;
            channel_connection_id: string | null;
            raw_payload: unknown;
            metadata: unknown;
          }>(rows);

          if (!message) {
            return new Response("Message not found or access denied", { status: 403 });
          }

          const meta = parseMetadata(message.metadata);
          const localRel = storagePathFromMetadata(meta);
          if (localRel) {
            const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
            const fullPath = resolveExistingUploadFile(uploadsRoot, localRel, {
              userId,
              tenantId: message.tenant_id || tenantId,
              email: "",
              role: "user",
            });
            if (fullPath) {
              return createUploadFileResponse(fullPath, request, {
                "Cache-Control": "private, max-age=3600",
              });
            }
          }

          let accessToken = "";
          let apiVersion = "v26.0";
          let phoneNumberId = "";

          const channelConnectionId = message.channel_connection_id;
          if (channelConnectionId) {
            const channelRows = await db.query(
              `SELECT
                 cc.provider,
                 cc.external_account_id,
                 cc.access_token_encrypted,
                 mac.app_secret_encrypted,
                 mac.graph_version
               FROM channel_connections cc
               JOIN meta_app_connections mac ON mac.id = cc.meta_app_connection_id
               WHERE cc.id = ? AND cc.tenant_id = ?
               LIMIT 1`,
              [channelConnectionId, message.tenant_id],
            );

            const channel = firstRow<{
              provider: string;
              external_account_id: string;
              access_token_encrypted: string | null;
              app_secret_encrypted: string | null;
              graph_version: string | null;
            }>(channelRows);

            if (channel) {
              const provider = channel.provider as "whatsapp" | "instagram";
              if (!["whatsapp", "instagram"].includes(provider)) {
                return new Response("Unsupported media provider", { status: 400 });
              }
              if (channel.access_token_encrypted) {
                try {
                  accessToken = decryptMetaCredential(channel.access_token_encrypted);
                } catch (err) {
                  console.error("[media.ts] Failed to decrypt access token:", err);
                }
              }
              apiVersion = channel.graph_version?.startsWith("v")
                ? channel.graph_version
                : `v${channel.graph_version || "26.0"}`;
              phoneNumberId = provider === "whatsapp" ? channel.external_account_id : "";
            }
          }

          if (!accessToken) {
            const profileRows = await db.query(
              `SELECT whatsapp_access_token, whatsapp_phone_number_id, meta_graph_version
               FROM profiles WHERE id = ? LIMIT 1`,
              [tenantId],
            );
            const profile = firstRow<{
              whatsapp_access_token: string | null;
              whatsapp_phone_number_id: string | null;
              meta_graph_version: string | null;
            }>(profileRows);
            accessToken = String(profile?.whatsapp_access_token || "").trim();
            phoneNumberId = phoneNumberId || String(profile?.whatsapp_phone_number_id || "").trim();
            apiVersion = profile?.meta_graph_version || apiVersion;
          }

          if (!accessToken) {
            return new Response("Channel access token not available", { status: 401 });
          }

          if (apiVersion.startsWith("v") && parseFloat(apiVersion.slice(1)) < 24.0) {
            apiVersion = "v26.0";
          }

          const graphMediaId =
            (typeof meta.media_id_meta === "string" && meta.media_id_meta) || mediaId;

          const metaUrl = phoneNumberId
            ? `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(graphMediaId)}?phone_number_id=${encodeURIComponent(phoneNumberId)}`
            : `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(graphMediaId)}`;

          const metadataResponse = await fetch(metaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          const metaBody = (await metadataResponse.json()) as {
            url?: string;
            mime_type?: string;
            filename?: string;
            error?: { message?: string };
          };

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

          const headers = new Headers();
          headers.set("Content-Type", mimeType);
          headers.set("Accept-Ranges", "bytes");
          headers.set("Cache-Control", "private, max-age=3600");
          headers.set("X-Content-Type-Options", "nosniff");

          if (download) {
            const filename = metaBody.filename || `file-${mediaId}`;
            headers.set("Content-Disposition", `attachment; filename="${filename}"`);
          } else {
            headers.set("Content-Disposition", "inline");
          }

          const range = request.headers.get("range");
          if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
            if (!match) {
              headers.set("Content-Range", `bytes */${mediaBytes.byteLength}`);
              return new Response(null, { status: 416, headers });
            }

            const requestedStart = match[1] ? Number(match[1]) : undefined;
            const requestedEnd = match[2] ? Number(match[2]) : undefined;
            const start = requestedStart ?? Math.max(mediaBytes.byteLength - (requestedEnd ?? 0), 0);
            const end =
              requestedStart === undefined
                ? mediaBytes.byteLength - 1
                : Math.min(requestedEnd ?? mediaBytes.byteLength - 1, mediaBytes.byteLength - 1);

            if (
              !Number.isSafeInteger(start) ||
              !Number.isSafeInteger(end) ||
              start < 0 ||
              start > end ||
              start >= mediaBytes.byteLength
            ) {
              headers.set("Content-Range", `bytes */${mediaBytes.byteLength}`);
              return new Response(null, { status: 416, headers });
            }

            const chunk = mediaBytes.slice(start, end + 1);
            headers.set("Content-Length", String(chunk.byteLength));
            headers.set("Content-Range", `bytes ${start}-${end}/${mediaBytes.byteLength}`);
            return new Response(chunk, { status: 206, headers });
          }

          headers.set("Content-Length", String(mediaBytes.byteLength));
          return new Response(mediaBytes, { status: 200, headers });
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
