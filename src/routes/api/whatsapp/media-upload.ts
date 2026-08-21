import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { transcodeAudioToMp3 } from "@/lib/audio-transcode.server";
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

function isWebM(bytes: Uint8Array) {
  return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

function isAnimatedWebP(bytes: Uint8Array) {
  for (let index = 12; index <= bytes.length - 4; index += 1) {
    if (
      bytes[index] === 0x41 &&
      bytes[index + 1] === 0x4e &&
      bytes[index + 2] === 0x49 &&
      bytes[index + 3] === 0x4d
    ) {
      return true;
    }
  }
  return false;
}

type MediaType = "image" | "audio" | "video" | "document" | "sticker";

const MEDIA_RULES: Record<MediaType, { maxBytes: number; mimeTypes: Set<string> }> = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: new Set(["image/jpeg", "image/png"]),
  },
  audio: {
    maxBytes: 16 * 1024 * 1024,
    mimeTypes: new Set([
      "audio/aac",
      "audio/mp4",
      "audio/mpeg",
      "audio/amr",
      "audio/ogg",
      "audio/webm",
    ]),
  },
  video: {
    maxBytes: 16 * 1024 * 1024,
    mimeTypes: new Set(["video/mp4", "video/3gpp"]),
  },
  document: {
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: new Set([
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),
  },
  sticker: {
    maxBytes: 500 * 1024,
    mimeTypes: new Set(["image/webp"]),
  },
};

function formatMetaError(body: any, fallback: string) {
  const error = body?.error;
  if (!error) return fallback;
  const identifiers = [
    error.code != null ? `code ${error.code}` : "",
    error.error_subcode != null ? `subcode ${error.error_subcode}` : "",
    error.fbtrace_id ? `fbtrace_id ${error.fbtrace_id}` : "",
  ].filter(Boolean);
  const details = error.error_data?.details;
  return [error.message || fallback, details, identifiers.length ? `(${identifiers.join(", ")})` : ""]
    .filter(Boolean)
    .join(" ");
}

function detectAudioFile(bytes: Uint8Array, declaredType: string, originalName: string) {
  const startsWith = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);

  if (startsWith(0x4f, 0x67, 0x67, 0x53)) {
    return { mimeType: "audio/ogg", fileName: originalName.replace(/\.[^.]+$/, "") + ".ogg" };
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { mimeType: "audio/mp4", fileName: originalName.replace(/\.[^.]+$/, "") + ".m4a" };
  }
  if (startsWith(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    const isAac = bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9);
    return {
      mimeType: isAac ? "audio/aac" : "audio/mpeg",
      fileName: originalName.replace(/\.[^.]+$/, "") + (isAac ? ".aac" : ".mp3"),
    };
  }
  if (startsWith(0x23, 0x21, 0x41, 0x4d, 0x52)) {
    return { mimeType: "audio/amr", fileName: originalName.replace(/\.[^.]+$/, "") + ".amr" };
  }
  if (declaredType.toLowerCase().startsWith("audio/")) {
    return { mimeType: declaredType, fileName: originalName || "audio.mp3" };
  }

  return {
    mimeType: declaredType || "application/octet-stream",
    fileName: originalName || "audio.mp3",
  };
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

async function persistOutgoingMedia({
  tenantId,
  bytes,
  mimeType,
  originalFileName,
}: {
  tenantId: string;
  bytes: Uint8Array;
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
  await fs.promises.writeFile(path.join(directory, fileName), Buffer.from(bytes));

  return {
    path: relativePath,
    url: `/api/storage/file?path=${encodeURIComponent(relativePath)}`,
    mime_type: mimeType,
    filename: path.basename(originalFileName || fileName),
    size: bytes.byteLength,
  };
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
          const requestedPhoneId = String(form.get("phoneId") || "").trim();
          const mediaType = String(form.get("mediaType") || "") as MediaType;
          const file = form.get("file");

          if (!requestedPhoneId || !(file instanceof File) || !MEDIA_RULES[mediaType]) {
            return json({ ok: false, error: "Envie phoneId, mediaType e file válidos no multipart/form-data." }, 400);
          }

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
            .eq("id", effectiveUserId)
            .maybeSingle();

          if (profErr) {
            return json({ ok: false, error: profErr.message }, 400);
          }

          if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
            return json(
              { ok: false, error: "Phone Number ID ou Access Token não configurado." },
              400,
            );
          }
          const rule = MEDIA_RULES[mediaType];
          let declaredMime = (file.type || "").toLowerCase().split(";")[0].trim();
          if (!declaredMime || declaredMime === "application/octet-stream") {
            const ext = (file.name || "").toLowerCase().split(".").pop();
            if (ext === "mp4") declaredMime = "video/mp4";
            else if (ext === "3gp" || ext === "3gpp") declaredMime = "video/3gpp";
            else if (ext === "jpg" || ext === "jpeg") declaredMime = "image/jpeg";
            else if (ext === "png") declaredMime = "image/png";
            else if (ext === "webp") declaredMime = "image/webp";
            else if (ext === "mp3") declaredMime = "audio/mpeg";
            else if (ext === "m4a") declaredMime = "audio/mp4";
            else if (ext === "ogg") declaredMime = "audio/ogg";
            else if (ext === "aac") declaredMime = "audio/aac";
            else if (ext === "amr") declaredMime = "audio/amr";
            else if (ext === "pdf") declaredMime = "application/pdf";
            else if (ext === "txt") declaredMime = "text/plain";
            else declaredMime = file.type || "application/octet-stream";
          }
          if (!rule.mimeTypes.has(declaredMime)) {
            return json(
              {
                ok: false,
                error: `Formato ${declaredMime} não suportado pela Cloud API para ${mediaType}.`,
              },
              415,
            );
          }
          const fileBuffer = new Uint8Array(await file.arrayBuffer());
          const maxBytes =
            mediaType === "sticker" && !isAnimatedWebP(fileBuffer)
              ? 100 * 1024
              : rule.maxBytes;
          const maxSizeLabel =
            maxBytes >= 1024 * 1024
              ? `${Math.floor(maxBytes / 1024 / 1024)} MB`
              : `${maxBytes / 1024} KB`;
          if (file.size > maxBytes) {
            return json(
              {
                ok: false,
                error: `Arquivo excede o limite de ${maxSizeLabel} para ${mediaType}.`,
              },
              413,
            );
          }

          let apiVersion = p.meta_graph_version || process.env.META_GRAPH_VERSION || "v26.0";
          if (apiVersion.startsWith("v") && parseFloat(apiVersion.slice(1)) < 24.0) {
            apiVersion = "v26.0";
          }

          let uploadBuffer: Uint8Array<ArrayBufferLike> = fileBuffer;
          let mimeType = declaredMime;
          let fileName = file.name || "media";

          if (mediaType === "audio") {
            const initialFile = isWebM(fileBuffer)
              ? { mimeType: "audio/webm", fileName: file.name || "audio.webm" }
              : detectAudioFile(
                  fileBuffer,
                  declaredMime,
                  file.name || "audio",
                );
            // Normaliza toda origem de áudio para um MP3 real. Isso evita enviar
            // WebM/Ogg apenas renomeado, que a Meta classifica como octet-stream.
            uploadBuffer = initialFile.mimeType.startsWith("audio/")
              ? await transcodeAudioToMp3(fileBuffer)
              : fileBuffer;
            const detectedFile = detectAudioFile(
              uploadBuffer,
              initialFile.mimeType.startsWith("audio/")
                ? "audio/mpeg"
                : declaredMime,
              initialFile.mimeType.startsWith("audio/") ? "audio.mp3" : file.name || "audio.mp3",
            );
            mimeType = detectedFile.mimeType;
            fileName = detectedFile.fileName;
          }
          
          const blobBuffer = uploadBuffer.slice().buffer as ArrayBuffer;
          const fileBlob = new Blob([blobBuffer], { type: mimeType });

          const metaForm = new FormData();
          metaForm.append("file", fileBlob, fileName);
          metaForm.append("type", mimeType);
          metaForm.append("messaging_product", "whatsapp");

          const r = await fetch(
            `https://graph.facebook.com/${apiVersion}/${p.whatsapp_phone_number_id}/media`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${p.whatsapp_access_token}`,
              },
              body: metaForm,
            },
          );

          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            console.error("[WhatsApp Media Upload] Meta recusou a mídia", {
              status: r.status,
              code: body?.error?.code,
              error_subcode: body?.error?.error_subcode,
              details: body?.error?.error_data?.details,
              fbtrace_id: body?.error?.fbtrace_id,
              mediaType,
              mimeType,
              size: file.size,
            });
            return json(
              {
                ok: false,
                error: formatMetaError(body, "Falha ao enviar mídia para a Meta."),
                metaError: body?.error ?? null,
              },
              r.status || 400,
            );
          }

          const localMedia = await persistOutgoingMedia({
            tenantId: effectiveUserId,
            bytes: uploadBuffer,
            mimeType,
            originalFileName: fileName,
          });

          return json({ ok: true, data: { ...body, local_media: localMedia } }, 200);
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
