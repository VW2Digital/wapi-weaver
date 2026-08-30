import type { MessageType } from "@/lib/omnichannel-next/domain/message-types";

export interface WhatsAppCapability {
  supported: boolean;
  implemented: boolean;
}

export type WhatsAppCapabilities = Record<MessageType, WhatsAppCapability>;

export const WHATSAPP_CAPABILITIES: WhatsAppCapabilities = {
  text: { supported: true, implemented: true },
  image: { supported: true, implemented: false },
  video: { supported: true, implemented: false },
  document: { supported: true, implemented: false },
  audio: { supported: true, implemented: false },
  sticker: { supported: true, implemented: false },
};
