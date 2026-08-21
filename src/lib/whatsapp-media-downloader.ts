/**
 * whatsapp-media-downloader.ts
 *
 * Realiza o download assíncrono em background de mídias recebidas pela Meta WhatsApp Cloud API
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

export async function downloadAndPersistInboundMedia(
  userId: string,
  messageId: string,
  waMessageId: string,
  mediaType: "image" | "audio" | "video" | "document" | "sticker",
  mediaMeta: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    filename?: string;
    caption?: string;
  },
  phoneNumberId?: string | null,
) {
  const mediaId = mediaMeta?.id;
  if (!mediaId) return;

  try {
    // 1. Busca credenciais do tenant
    const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
    const effectiveUserId = await resolveEffectiveUserId(userId);

    const { data: p } = await dbAdmin
      .from("profiles")
      .select("whatsapp_access_token, whatsapp_phone_number_id, meta_graph_version")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      console.warn(`[Media Downloader] Sem access token para o tenant ${userId}`);
      return;
    }

    const accessToken = p.whatsapp_access_token.trim();
    const resolvedPhoneId = phoneNumberId || p.whatsapp_phone_number_id?.trim() || "";
    let apiVersion = p.meta_graph_version || "v26.0";
    if (apiVersion.startsWith("v") && parseFloat(apiVersion.slice(1)) < 24.0) {
      apiVersion = "v26.0";
    }

    // 2. Resolve URL real do arquivo na Meta
    const metaUrl = resolvedPhoneId
      ? `https://graph.facebook.com/${apiVersion}/${mediaId}?phone_number_id=${encodeURIComponent(resolvedPhoneId)}`
      : `https://graph.facebook.com/${apiVersion}/${mediaId}`;

    const metadataRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metadataRes.ok) {
      const errText = await metadataRes.text();
      console.error(`[Media Downloader] Falha ao resolver metadados da mídia ${mediaId}:`, errText);
      return;
    }

    const metaBody = await metadataRes.json();
    const downloadUrl = metaBody.url;
    if (!downloadUrl) {
      console.error(`[Media Downloader] Meta não retornou URL para a mídia ${mediaId}`);
      return;
    }

    // 3. Baixa os bytes binários com header Authorization
    const binaryRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!binaryRes.ok) {
      console.error(`[Media Downloader] Falha no download do binário da mídia ${mediaId}: HTTP ${binaryRes.status}`);
      return;
    }

    const arrayBuffer = await binaryRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // 4. Determina extensão e caminho local isolado por tenant
    let mimeType = metaBody.mime_type || mediaMeta.mime_type || "application/octet-stream";
    let cleanMime = mimeType.split(";")[0].trim().toLowerCase();
    let ext = MIME_EXTENSION_MAP[cleanMime] || "bin";

    if (mediaType === "audio") {
      buffer = Buffer.from(await transcodeAudioToMp3(buffer));
      mimeType = "audio/mpeg";
      cleanMime = mimeType;
      ext = "mp3";
    } else if (mediaType === "document" && mediaMeta.filename) {
      const parts = mediaMeta.filename.split(".");
      if (parts.length > 1) {
        ext = parts.pop()!.toLowerCase();
      }
    } else if (mediaType === "sticker") {
      ext = "webp";
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const fileUuid = randomUUID();
    const fileName = `${fileUuid}.${ext}`;

    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", userId, year, month);
    fs.mkdirSync(uploadsDir, { recursive: true });

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);

    const relativePublicPath = `${userId}/${year}/${month}/${fileName}`;
    const servedMediaUrl = `/api/storage/file?path=${encodeURIComponent(relativePublicPath)}`;

    // 5. Atualiza a mensagem na tabela direct_messages com a URL local e metadados
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
      mime_type: mimeType,
      file_size: buffer.length,
      original_filename: mediaMeta.filename || metaBody.filename || null,
      media_id_meta: mediaId,
      [mediaType]: {
        ...(existingMeta[mediaType] || {}),
        id: mediaId,
        link: servedMediaUrl,
        mime_type: mimeType,
        file_size: buffer.length,
        filename: mediaMeta.filename || metaBody.filename || null,
      },
    };

    await dbAdmin
      .from("direct_messages")
      .update({
        metadata: updatedMeta,
      })
      .eq("id", messageId);

    console.log(`[Media Downloader] Mídia ${mediaId} persistida com sucesso em ${localFilePath} (${buffer.length} bytes)`);
  } catch (error: any) {
    console.error(`[Media Downloader] Erro inesperado ao baixar mídia ${mediaId}:`, error?.stack || error?.message || error);
  }
}
