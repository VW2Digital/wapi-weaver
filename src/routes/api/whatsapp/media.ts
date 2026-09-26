import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { resolveMediaContentType } from "@/lib/media-content-type";
import db from "@/lib/db";
import { createUploadFileResponse } from "@/lib/upload-file-response.server";
import { resolveExistingUploadFile } from "@/lib/tenant-storage";
import {
  getChannelConnection,
  getChannelConnectionByExternalAccount,
  resolveChannelAccessToken,
} from "@/lib/messaging/channel-connection.service";

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

function collectRemoteUrls(meta: Record<string, any>, mediaId: string, rawPayload: unknown): string[] {
  const urls: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    if (!value.startsWith("http://") && !value.startsWith("https://")) return;
    if (value.includes("/api/storage/file") || value.includes("/api/whatsapp/media")) return;
    urls.push(value);
  };
  push(mediaId);
  push(meta.original_remote_url);
  push(meta.media_url);
  for (const kind of ["image", "audio", "video", "document", "sticker"]) {
    const obj = meta[kind];
    if (obj && typeof obj === "object") {
      push(obj.url);
      push(obj.link);
    }
  }
  const payload = parseMetadata(rawPayload);
  const message = payload.message && typeof payload.message === "object" ? payload.message : payload;
  for (const kind of ["image", "audio", "video", "document", "sticker"]) {
    const obj = (message as Record<string, any>)[kind];
    if (obj && typeof obj === "object") {
      push(obj.url);
      push(obj.link);
    }
  }
  return [...new Set(urls)];
}

function graphVersion(raw?: string | null) {
  const v = String(raw || process.env.META_GRAPH_VERSION || "v26.0").trim();
  if (/^v2[4-6]\.\d+$/.test(v)) return v;
  return "v26.0";
}

async function fetchBinary(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res = await fetch(url, { headers });
  if (!res.ok && token) {
    res = await fetch(url);
  }
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 16) return null;
  return { bytes, contentType: res.headers.get("content-type") };
}

function respondWithBytes(
  request: Request,
  mediaBytes: Uint8Array,
  mimeType: string,
  filename: string,
  download: boolean,
) {
  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Content-Disposition",
    download ? `attachment; filename="${filename}"` : "inline",
  );

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
}

function persistBytes(tenantId: string, bytes: Uint8Array, ext: string) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `${randomUUID()}.${ext}`;
  const uploadsDir = path.resolve(process.cwd(), "public", "uploads", tenantId, year, month);
  fs.mkdirSync(uploadsDir, { recursive: true });
  const fullPath = path.join(uploadsDir, fileName);
  fs.writeFileSync(fullPath, Buffer.from(bytes));
  return `${tenantId}/${year}/${month}/${fileName}`;
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
          const mediaId = url.searchParams.get("id") || "local";
          const messageId = url.searchParams.get("messageId");
          const contactId = url.searchParams.get("contactId");
          const download = url.searchParams.get("download") === "1";
          const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

          if (contactId) {
            const contactRows = await db.query(
              `SELECT id, tenant_id, user_id, channel, custom_fields, avatar_url, phone_e164, external_contact_id
               FROM contacts
               WHERE id = ? AND (user_id = ? OR tenant_id = ?)
               LIMIT 1`,
              [contactId, tenantId, tenantId],
            );
            const contact = firstRow<{
              id: string;
              tenant_id: string;
              channel: string | null;
              custom_fields: unknown;
              avatar_url: string | null;
              phone_e164: string | null;
              external_contact_id: string | null;
            }>(contactRows);
            if (!contact) {
              return new Response("Contact not found or access denied", { status: 403 });
            }
            const cached = resolveExistingUploadFile(uploadsRoot, `${contact.tenant_id}/avatars/${contact.id}.jpg`, {
              userId,
              tenantId: contact.tenant_id || tenantId,
              email: "",
              role: "user",
            });
            if (cached) {
              return createUploadFileResponse(cached, request, { "Cache-Control": "private, max-age=3600" });
            }

            const cf = parseMetadata(contact.custom_fields);
            const igsid = String(
              cf.igsid || cf.ig_sid || contact.external_contact_id || contact.phone_e164 || "",
            ).trim();
            let token = "";
            if (contact.channel === "instagram" && igsid) {
              const msgConnRows = await db.query(
                `SELECT channel_connection_id, provider_account_id
                 FROM direct_messages
                 WHERE tenant_id = ?
                   AND channel = 'instagram'
                   AND (contact_phone = ? OR contact_phone = ?)
                   AND channel_connection_id IS NOT NULL
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [contact.tenant_id || tenantId, contact.phone_e164, contact.external_contact_id],
              );
              const msgConn = firstRow<{
                channel_connection_id: string;
                provider_account_id: string | null;
              }>(msgConnRows);
              if (msgConn?.channel_connection_id) {
                try {
                  const ch = await getChannelConnection(
                    msgConn.channel_connection_id,
                    contact.tenant_id || tenantId,
                  );
                  token = resolveChannelAccessToken(ch);
                } catch {
                  token = "";
                }
              }
            }
            if (token && igsid) {
              const profileRes = await fetch(
                `https://graph.facebook.com/v26.0/${encodeURIComponent(igsid)}?fields=profile_pic`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              const profileJson = (await profileRes.json().catch(() => ({}))) as { profile_pic?: string };
              if (profileJson.profile_pic) {
                const bin = await fetchBinary(profileJson.profile_pic, token);
                if (bin) {
                  const avatarRel = `${contact.tenant_id}/avatars/${contact.id}.jpg`;
                  const avatarDir = path.resolve(uploadsRoot, contact.tenant_id, "avatars");
                  fs.mkdirSync(avatarDir, { recursive: true });
                  fs.writeFileSync(path.join(avatarDir, `${contact.id}.jpg`), Buffer.from(bin.bytes));
                  const mimeType = resolveMediaContentType({
                    fileName: "avatar.jpg",
                    upstreamContentType: bin.contentType,
                    bytes: bin.bytes,
                  });
                  return respondWithBytes(request, bin.bytes, mimeType, "avatar.jpg", false);
                }
              }
            }
            return new Response("Avatar unavailable", { status: 404 });
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
               dm.provider_account_id,
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
            provider_account_id: string | null;
            raw_payload: unknown;
            metadata: unknown;
          }>(rows);

          if (!message) {
            return new Response("Message not found or access denied", { status: 403 });
          }

          const isInstagram = message.channel === "instagram";
          const meta = parseMetadata(message.metadata);
          const localRel = storagePathFromMetadata(meta);
          if (localRel) {
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
          let provider: "whatsapp" | "instagram" | null = isInstagram ? "instagram" : "whatsapp";

          if (message.channel_connection_id) {
            try {
              const ch = await getChannelConnection(message.channel_connection_id, message.tenant_id);
              accessToken = resolveChannelAccessToken(ch);
              provider = ch.provider === "instagram" ? "instagram" : "whatsapp";
              if (provider === "whatsapp") phoneNumberId = ch.externalAccountId || "";
            } catch (err) {
              console.error("[media.ts] channel_connection resolve failed", err);
            }
          }

          if (!accessToken && isInstagram && message.provider_account_id) {
            const ch = await getChannelConnectionByExternalAccount(
              message.tenant_id,
              "instagram",
              message.provider_account_id,
            );
            if (ch) {
              try {
                accessToken = resolveChannelAccessToken(ch);
                provider = "instagram";
              } catch {
                accessToken = "";
              }
            }
          }

          if (!accessToken && !isInstagram) {
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
            apiVersion = graphVersion(profile?.meta_graph_version);
          }

          if (!accessToken) {
            return new Response("Channel access token not available", { status: 401 });
          }

          apiVersion = graphVersion(apiVersion);

          const remoteUrls = collectRemoteUrls(meta, mediaId, message.raw_payload);
          for (const remote of remoteUrls) {
            const bin = await fetchBinary(remote, accessToken);
            if (bin) {
              const mimeType = resolveMediaContentType({
                upstreamContentType: bin.contentType,
                bytes: bin.bytes,
              });
              const ext = mimeType.includes("png")
                ? "png"
                : mimeType.includes("webp")
                  ? "webp"
                  : mimeType.includes("mp4")
                    ? "mp4"
                    : mimeType.includes("mpeg") || mimeType.includes("mp3")
                      ? "mp3"
                      : "jpg";
              try {
                const relative = persistBytes(message.tenant_id || tenantId, bin.bytes, ext);
                const served = `/api/storage/file?path=${encodeURIComponent(relative)}`;
                await db.query(
                  `UPDATE direct_messages SET metadata = JSON_SET(COALESCE(metadata, '{}'), '$.media_url', ?, '$.local_file_path', ?) WHERE id = ? AND tenant_id = ?`,
                  [served, relative, message.id, message.tenant_id],
                );
              } catch (persistErr) {
                console.error("[media.ts] persist failed", persistErr);
              }
              return respondWithBytes(request, bin.bytes, mimeType, `file.${ext}`, download);
            }
          }

          if (isInstagram || provider === "instagram") {
            const graphMediaId =
              (typeof meta.media_id_meta === "string" && meta.media_id_meta) || mediaId;
            if (graphMediaId && graphMediaId !== "local" && !graphMediaId.startsWith("http")) {
              const igMetaRes = await fetch(
                `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(graphMediaId)}?fields=url,mime_type`,
                { headers: { Authorization: `Bearer ${accessToken}` } },
              );
              const igMeta = (await igMetaRes.json().catch(() => ({}))) as {
                url?: string;
                mime_type?: string;
                error?: { message?: string };
              };
              if (igMeta.url) {
                const bin = await fetchBinary(igMeta.url, accessToken);
                if (bin) {
                  const mimeType = resolveMediaContentType({
                    declaredMimeType: igMeta.mime_type,
                    upstreamContentType: bin.contentType,
                    bytes: bin.bytes,
                  });
                  return respondWithBytes(request, bin.bytes, mimeType, "instagram-media", download);
                }
              }
            }
            return new Response("Instagram media expired or unavailable", { status: 404 });
          }

          const graphMediaId =
            (typeof meta.media_id_meta === "string" && meta.media_id_meta) || mediaId;
          if (!graphMediaId || graphMediaId === "local" || graphMediaId.startsWith("http")) {
            return new Response("Media file not found", { status: 404 });
          }

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
              { status: metadataResponse.status === 400 ? 404 : metadataResponse.status || 404 },
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
          return respondWithBytes(
            request,
            mediaBytes,
            mimeType,
            metaBody.filename || `file-${mediaId}`,
            download,
          );
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
