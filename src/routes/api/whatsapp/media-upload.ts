import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { transcodeAudioToOggOpus } from "@/lib/audio-transcode.server";
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

function detectMediaFile(bytes: Uint8Array, declaredType: string, originalName: string) {
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
    throw new Error("Não foi possível validar o formato real do áudio. Use Ogg/Opus, MP3, M4A, AAC ou AMR.");
  }

  return {
    mimeType: declaredType || "application/octet-stream",
    fileName: originalName || "media.bin",
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
          const declaredMime = (file.type || "application/octet-stream").toLowerCase();
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

          const initialFile = isWebM(fileBuffer)
            ? { mimeType: "audio/webm" }
            : detectMediaFile(
                fileBuffer,
                file.type || "application/octet-stream",
                file.name || "media",
              );
          // voice=true exige Ogg/Opus. Normalizamos também MP3/M4A/AAC/AMR
          // para que anexos de áudio sigam a mesma regra da gravação.
          const uploadBuffer = initialFile.mimeType.startsWith("audio/")
            ? await transcodeAudioToOggOpus(fileBuffer)
            : fileBuffer;
          const detectedFile = detectMediaFile(
            uploadBuffer,
            initialFile.mimeType.startsWith("audio/")
              ? "audio/ogg"
              : file.type || "application/octet-stream",
            initialFile.mimeType.startsWith("audio/") ? "audio.ogg" : file.name || "media",
          );
          const mimeType = detectedFile.mimeType;
          const fileName = detectedFile.fileName;
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
