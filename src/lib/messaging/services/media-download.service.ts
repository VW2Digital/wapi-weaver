"use server";

import type { CanonicalAttachment, CanonicalMessage, MessagingProvider } from "../types";

export interface DownloadMediaOptions {
  tenantId: string;
  messageId: string;
  provider: MessagingProvider;
  message: CanonicalMessage;
  channelResourceId: string | null;
}

function isMediaType(type: string): type is "image" | "audio" | "video" | "document" | "sticker" {
  return ["image", "audio", "video", "document", "sticker"].includes(type);
}

export async function downloadMessageMedia(
  options: DownloadMediaOptions,
): Promise<void> {
  const { tenantId, messageId, provider, message, channelResourceId } = options;

  if (!message.attachments || message.attachments.length === 0) return;

  for (const attachment of message.attachments) {
    if (!isMediaType(attachment.type)) continue;

    if (provider === "whatsapp") {
      const waMessageId = message.providerMessageId;
      const mediaMeta: {
        id?: string;
        mime_type?: string;
        sha256?: string;
        filename?: string;
        caption?: string;
      } = {
        id: attachment.providerMediaId ?? undefined,
        mime_type: attachment.mimeType ?? undefined,
        sha256: attachment.sha256 ?? undefined,
        filename: attachment.filename ?? undefined,
        caption: attachment.caption ?? undefined,
      };

      const { downloadAndPersistInboundMedia } = await import("@/lib/whatsapp-media-downloader");
      await downloadAndPersistInboundMedia(
        tenantId,
        messageId,
        waMessageId,
        attachment.type,
        mediaMeta,
        channelResourceId,
      );
    }

    if (provider === "instagram") {
      const remoteUrl = attachment.remoteUrl;
      if (!remoteUrl) continue;

      const { downloadAndPersistInstagramMedia } = await import("@/lib/instagram-media-downloader");
      await downloadAndPersistInstagramMedia(
        tenantId,
        messageId,
        attachment.type,
        remoteUrl,
        attachment.filename,
      );
    }

    if (provider === "messenger") {
      const remoteUrl = attachment.remoteUrl;
      if (!remoteUrl) continue;

      // Messenger uses the same Instagram downloader because the attachment payload shape is similar.
      const { downloadAndPersistInstagramMedia } = await import("@/lib/instagram-media-downloader");
      await downloadAndPersistInstagramMedia(
        tenantId,
        messageId,
        attachment.type,
        remoteUrl,
        attachment.filename,
      );
    }
  }
}
