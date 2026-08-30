export type MessageType = "text" | "image" | "video" | "document" | "audio" | "sticker";

export interface MediaReference {
  reference: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
}

export interface OutboundMessage {
  type: MessageType;
  text?: string;
  media?: MediaReference;
}
