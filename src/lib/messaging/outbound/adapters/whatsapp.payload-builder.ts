"use server";

import type { ChatProviderPayload } from "@/lib/chat-outbox.server";

export interface WhatsAppOutboundPayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: string;
  [key: string]: unknown;
}

export function buildWhatsAppOutboundPayload(
  recipient: string,
  data: ChatProviderPayload,
): WhatsAppOutboundPayload {
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: data.type,
  };

  if (data.reply_to_message_id) {
    payload.context = { message_id: data.reply_to_message_id };
  }

  if (data.type === "text") {
    payload.text = {
      body: data.text?.body || "",
      preview_url: data.text?.preview_url ?? false,
    };
  } else if (data.type === "reaction") {
    payload.reaction = data.reaction;
  } else if (data.type === "image") {
    payload.image = data.image?.id ? { id: data.image.id } : { link: data.image?.link };
  } else if (data.type === "audio") {
    payload.audio = data.audio?.id
      ? { id: data.audio.id, ...(data.audio.voice ? { voice: true } : {}) }
      : { link: data.audio?.link, ...(data.audio?.voice ? { voice: true } : {}) };
  } else if (data.type === "video") {
    payload.video = data.video?.id ? { id: data.video.id } : { link: data.video?.link };
  } else if (data.type === "document") {
    payload.document = data.document?.id
      ? { id: data.document.id, filename: data.document.filename }
      : { link: data.document?.link, filename: data.document?.filename };
  } else if (data.type === "sticker") {
    payload.sticker = data.sticker?.id ? { id: data.sticker.id } : { link: data.sticker?.link };
  } else if (data.type === "location") {
    payload.location = data.location;
  } else if (data.type === "contacts") {
    payload.contacts = data.contacts;
  }

  return payload as WhatsAppOutboundPayload;
}
