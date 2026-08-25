/**
 * instagram-media-downloader.ts
 *
 * Realiza o download assíncrono em background de mídias recebidas pelo Instagram Graph API
 * e as persiste localmente no disco do VPS isoladas por tenant_id.
 *
 * Estrutura de armazenamento:
 *   public/uploads/{tenant_id}/{ano}/{mes}/{uuid}.{ext}
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { transcodeAudioToMp3 } from "@/lib/audio-transcode.server";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
};

export async function downloadAndPersistInstagramMedia(
  userId: string,
  messageId: string,
  mediaType: "image" | "audio" | "video" | "document" | "sticker",
  remoteMediaUrl: string,
  customFilename?: string | null,
) {
  if (!remoteMediaUrl || !remoteMediaUrl.startsWith("http")) return;

  try {
    const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(userId);

    // 1. Baixa os bytes binários da URL pública/assinada da Meta
    const binaryRes = await fetch(remoteMediaUrl);
    if (!binaryRes.ok) {
      console.error(
        `[Instagram Media Downloader] Falha ao baixar binário da URL ${remoteMediaUrl}: HTTP ${binaryRes.status}`,
      );
      return;
    }

    const arrayBuffer = await binaryRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    const contentTypeHeader = binaryRes.headers.get("content-type") || "";
    let cleanMime = contentTypeHeader.split(";")[0].trim().toLowerCase();
    let ext = MIME_EXTENSION_MAP[cleanMime] || "bin";

    if (mediaType === "audio") {
      buffer = Buffer.from(await transcodeAudioToMp3(buffer));
      cleanMime = "audio/mpeg";
      ext = "mp3";
    } else if (mediaType === "image" && ext === "bin") {
      ext = "jpg";
      cleanMime = "image/jpeg";
    } else if (mediaType === "video" && ext === "bin") {
      ext = "mp4";
      cleanMime = "video/mp4";
    } else if (mediaType === "sticker") {
      ext = "webp";
      cleanMime = "image/webp";
    }

    if (customFilename && customFilename.includes(".")) {
      const parts = customFilename.split(".");
      if (parts.length > 1) {
        ext = parts.pop()!.toLowerCase();
      }
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const fileUuid = randomUUID();
    const fileName = `${fileUuid}.${ext}`;

    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", effectiveUserId, year, month);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);

    const relativePublicPath = `${effectiveUserId}/${year}/${month}/${fileName}`;
    const servedMediaUrl = `/api/storage/file?path=${encodeURIComponent(relativePublicPath)}`;

    // 2. Atualiza a mensagem na tabela direct_messages com a URL local persistida
    const { data: currentMsg } = await dbAdmin
      .from("direct_messages")
      .select("metadata")
      .eq("id", messageId)
      .maybeSingle();

    const existingMeta = (currentMsg?.metadata || {}) as Record<string, any>;
    const updatedMeta = {
      ...existingMeta,
      media_url: servedMediaUrl,
      local_file_path: relativePublicPath,
      mime_type: cleanMime,
      file_size: buffer.length,
      original_filename: customFilename || null,
      original_remote_url: remoteMediaUrl,
      [mediaType]: {
        ...(existingMeta[mediaType] || {}),
        url: servedMediaUrl,
        link: servedMediaUrl,
        mime_type: cleanMime,
        file_size: buffer.length,
        filename: customFilename || null,
      },
    };

    await dbAdmin
      .from("direct_messages")
      .update({
        metadata: updatedMeta,
      })
      .eq("id", messageId);

    console.log(
      `[Instagram Media Downloader] Mídia persistida com sucesso em ${localFilePath} (${buffer.length} bytes)`,
    );
  } catch (error: any) {
    console.error(
      `[Instagram Media Downloader] Erro inesperado ao baixar mídia:`,
      error?.stack || error?.message || error,
    );
  }
}
