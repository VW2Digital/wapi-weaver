import type { MessagingProvider, MessageStatus } from "../types";

export interface OutboundMessageContext {
  tenantId: string;
  userId: string;
  messageId: string;
  conversationId?: string | null;
  channelConnectionId?: string | null;
  provider: MessagingProvider;
  contactPhone: string;
  providerRecipientId?: string | null;
  providerAccountId?: string | null;
  type: string;
  payload: {
    type: string;
    text?: { body: string; preview_url?: boolean };
    reaction?: { message_id: string; emoji: string };
    image?: { id?: string; link?: string };
    audio?: { id?: string; link?: string; voice?: boolean };
    video?: { id?: string; link?: string };
    document?: { id?: string; link?: string; filename?: string };
    sticker?: { id?: string; link?: string };
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    contacts?: unknown[];
    reply_to_message_id?: string;
    [key: string]: unknown;
  };
  metadata: unknown;
  replyToMessageId?: string | null;
}

export interface OutboundSendResult {
  provider: MessagingProvider;
  providerMessageId: string | null;
  providerAccountId: string | null;
  status: MessageStatus;
  responsePayload: unknown;
}

export interface IOutboundAdapter {
  readonly provider: MessagingProvider;
  send(context: OutboundMessageContext): Promise<OutboundSendResult>;
}

export class UnsupportedProviderError extends Error {
  constructor(public readonly provider: string) {
    super(`Unsupported messaging provider: ${provider}`);
    this.name = "UnsupportedProviderError";
  }
}
