import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveEffectiveUserId } from "@/lib/chat-helpers";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { transcodeAudioToM4a, transcodeVideoToMp4 } from "@/lib/audio-transcode.server";
import {
  inferInstagramVideoMime,
  isAcceptedInstagramVideoMime,
  looksLikeFtypContainer,
} from "@/lib/instagram-media-format";

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

type MediaType = "image" | "audio" | "video" | "document" | "sticker";

const MEDIA_RULES: Record<MediaType, { maxBytes: number; mimeTypes: Set<string> }> = {
  image: {
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: new Set(["image/jpeg", "image/png", "image/gif"]),
  },
  audio: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: new Set(["audio/aac", "audio/m4a", "audio/wav", "audio/mp4", "audio/webm", "audio/ogg", "audio/mpeg"]),
  },
  video: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: new Set([
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-matroska",
      "video/x-msvideo",
      "video/avi",
      "video/3gpp",
      "video/3gpp2",
    ]),
  },
  document: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: new Set(["application/pdf"]),
  },
  sticker: {
    maxBytes: 100 * 1024,
    mimeTypes: new Set(["image/webp"]),
  },
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "audio/aac": "aac",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

async function persistLocalMedia({
  tenantId,
  buffer,
  mimeType,
  originalFileName,
  publicBaseUrl,
}: {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
  publicBaseUrl?: string;
}) {
  const originalExtension = path.extname(originalFileName).slice(1).toLowerCase();
  const safeOriginalExtension = /^[a-z0-9]{1,10}$/.test(originalExtension)
    ? originalExtension
    : "";
  const extension = MIME_EXTENSIONS[mimeType] || safeOriginalExtension || "bin";
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = `${tenantId}/${year}/${month}/${fileName}`;
  const directory = path.resolve(process.cwd(), "public", "uploads", tenantId, year, month);

  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(path.join(directory, fileName), buffer);

  const relativeUrl = `/api/storage/file?path=${encodeURIComponent(relativePath)}`;
  const baseUrl = (publicBaseUrl || process.env.APP_URL || "").replace(/\/$/, "");
  const url = baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl;

  return {
    path: relativePath,
    url,
    mime_type: mimeType,
    filename: path.basename(originalFileName || fileName),
    size: buffer.length,
  };
}

export const Route = createFileRoute("/api/instagram/media-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = getAuthUserId(request);
          const effectiveUserId = await resolveEffectiveUserId(userId);

          const form = await request.formData();
          const mediaType = String(form.get("mediaType") || "") as MediaType;
          const file = form.get("file");
          const isBlob = typeof Blob !== "undefined" && file instanceof Blob;

          if (!isBlob || !MEDIA_RULES[mediaType]) {
            return json(
              { ok: false, error: "Envie mediaType e file válidos no multipart/form-data." },
              400,
            );
          }

          const uploadName =
            typeof File !== "undefined" && file instanceof File
              ? file.name || "media"
              : "media";
          const uploadType = file.type || "";

          const rule = MEDIA_RULES[mediaType];
          const incomingMaxBytes = mediaType === "video" ? 80 * 1024 * 1024 : rule.maxBytes;
          if (file.size > incomingMaxBytes) {
            const maxSizeLabel =
              incomingMaxBytes >= 1024 * 1024
                ? `${Math.floor(incomingMaxBytes / 1024 / 1024)} MB`
                : `${incomingMaxBytes / 1024} KB`;
            return json(
              {
                ok: false,
                error: `Arquivo excede o limite de ${maxSizeLabel} para ${mediaType}.`,
              },
              413,
            );
          }

          let declaredMime = (uploadType || "").toLowerCase().split(";")[0].trim();
          if (mediaType === "video") {
            declaredMime = inferInstagramVideoMime(declaredMime, uploadName);
          } else if (!declaredMime || declaredMime === "application/octet-stream") {
            const ext = (uploadName || "").toLowerCase().split(".").pop();
            if (ext === "mp4") declaredMime = "video/mp4";
            else if (ext === "jpg" || ext === "jpeg") declaredMime = "image/jpeg";
            else if (ext === "png") declaredMime = "image/png";
            else if (ext === "gif") declaredMime = "image/gif";
            else if (ext === "webp") declaredMime = "image/webp";
            else if (ext === "pdf") declaredMime = "application/pdf";
            else if (ext === "m4a") declaredMime = "audio/mp4";
            else if (ext === "aac") declaredMime = "audio/aac";
            else if (ext === "wav") declaredMime = "audio/wav";
          }

          if (mediaType === "video") {
            if (
              declaredMime &&
              !isAcceptedInstagramVideoMime(declaredMime) &&
              !declaredMime.startsWith("video/")
            ) {
              return json(
                {
                  ok: false,
                  error: `Formato ${declaredMime} não suportado pelo Instagram para vídeo.`,
                },
                415,
              );
            }
          } else if (!rule.mimeTypes.has(declaredMime)) {
            return json(
              {
                ok: false,
                error: `Formato ${declaredMime} não suportado pelo Instagram para ${mediaType}.`,
              },
              415,
            );
          }

          let fileBuffer = Buffer.from(await file.arrayBuffer());

          if (mediaType === "video" && (!declaredMime || declaredMime === "application/octet-stream")) {
            if (looksLikeFtypContainer(fileBuffer)) {
              declaredMime = "video/mp4";
            }
          }

          if (mediaType === "audio") {
            try {
              fileBuffer = Buffer.from(await transcodeAudioToM4a(new Uint8Array(fileBuffer)));
              declaredMime = "audio/mp4";
            } catch (transcodeErr: any) {
              console.error("[Instagram Media Upload] Falha ao transcodificar áudio:", transcodeErr);
              return json(
                { ok: false, error: "Falha ao converter o áudio gravado." },
                500,
              );
            }
          }

          if (mediaType === "video") {
            try {
              fileBuffer = Buffer.from(await transcodeVideoToMp4(new Uint8Array(fileBuffer)));
              declaredMime = "video/mp4";
            } catch (transcodeErr: any) {
              console.error("[Instagram Media Upload] Falha ao transcodificar vídeo:", transcodeErr);
              return json(
                {
                  ok: false,
                  error:
                    transcodeErr?.message ||
                    "Falha ao converter o vídeo. Envie um MP4 (H.264) de até 25 MB.",
                },
                415,
              );
            }
          }

          if (fileBuffer.length > rule.maxBytes) {
            const maxSizeLabel =
              rule.maxBytes >= 1024 * 1024
                ? `${Math.floor(rule.maxBytes / 1024 / 1024)} MB`
                : `${rule.maxBytes / 1024} KB`;
            return json(
              {
                ok: false,
                error: `Arquivo excede o limite de ${maxSizeLabel} para ${mediaType}.`,
              },
              413,
            );
          }

          const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
          const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
          const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";

          const localMedia = await persistLocalMedia({
            tenantId: effectiveUserId,
            buffer: fileBuffer,
            mimeType: declaredMime,
            originalFileName: uploadName,
            publicBaseUrl: (process.env.APP_URL || requestOrigin || "").replace(/\/$/, ""),
          });

          return json(
            {
              ok: true,
              data: {
                id: null,
                link: localMedia.url,
                local_media: localMedia,
              },
            },
            200,
          );
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
