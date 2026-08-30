import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveEffectiveUserId } from "@/lib/chat-helpers";
import { JWT_SECRET } from "@/lib/jwt-secret";
import { transcodeAudioToM4a } from "@/lib/audio-transcode.server";

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
    mimeTypes: new Set(["image/jpeg", "image/png"]),
  },
  audio: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: new Set(["audio/aac", "audio/m4a", "audio/wav", "audio/mp4", "audio/webm", "audio/ogg", "audio/mpeg"]),
  },
  video: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: new Set(["video/mp4"]),
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
}: {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
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
  const baseUrl = (process.env.APP_URL || "").replace(/\/$/, "");
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

          if (!(file instanceof File) || !MEDIA_RULES[mediaType]) {
            return json(
              { ok: false, error: "Envie mediaType e file válidos no multipart/form-data." },
              400,
            );
          }

          const rule = MEDIA_RULES[mediaType];
          let declaredMime = (file.type || "").toLowerCase().split(";")[0].trim();
          if (!declaredMime || declaredMime === "application/octet-stream") {
            const ext = (file.name || "").toLowerCase().split(".").pop();
            if (ext === "mp4") declaredMime = "video/mp4";
            else if (ext === "jpg" || ext === "jpeg") declaredMime = "image/jpeg";
            else if (ext === "png") declaredMime = "image/png";
            else if (ext === "webp") declaredMime = "image/webp";
            else if (ext === "pdf") declaredMime = "application/pdf";
            else if (ext === "m4a") declaredMime = "audio/mp4";
            else if (ext === "aac") declaredMime = "audio/aac";
            else if (ext === "wav") declaredMime = "audio/wav";
          }

          if (!rule.mimeTypes.has(declaredMime)) {
            return json(
              {
                ok: false,
                error: `Formato ${declaredMime} não suportado pelo Instagram para ${mediaType}.`,
              },
              415,
            );
          }

          let fileBuffer = Buffer.from(await file.arrayBuffer());

          if (mediaType === "audio" && (declaredMime === "audio/webm" || declaredMime.startsWith("audio/ogg"))) {
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

          if (file.size > rule.maxBytes) {
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

          const localMedia = await persistLocalMedia({
            tenantId: effectiveUserId,
            buffer: fileBuffer,
            mimeType: declaredMime,
            originalFileName: file.name || "media",
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
