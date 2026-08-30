import type { MessageType } from "@/lib/omnichannel-next/domain/message-types";

export interface InstagramCapability {
  supported: boolean;
  implemented: boolean;
}

export type InstagramCapabilities = Record<MessageType, InstagramCapability>;

export const INSTAGRAM_CAPABILITIES: InstagramCapabilities = {
  text: { supported: true, implemented: true },
  image: { supported: true, implemented: false },
  video: { supported: true, implemented: false },
  document: { supported: false, implemented: false },
  audio: { supported: false, implemented: false },
  sticker: { supported: true, implemented: false },
};
