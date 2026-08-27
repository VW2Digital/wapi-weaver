"use server";

import { publishChatRealtimeEvent } from "@/lib/chat-realtime.server";
import type { MessageStatus, MessagingProvider } from "../types";

export interface PublishMessageReceivedOptions {
  tenantId: string;
  contactPhone: string;
  messageId: string;
  providerMessageId: string;
  provider: MessagingProvider;
  status?: "delivered" | "sent" | null;
}

export async function publishMessageReceived(
  options: PublishMessageReceivedOptions,
): Promise<void> {
  await publishChatRealtimeEvent({
    type: "message.received",
    tenant_id: options.tenantId,
    contact_phone: options.contactPhone,
    message_id: options.messageId,
    provider_message_id: options.providerMessageId,
    status: options.status ?? null,
  });
}

export interface PublishMessageSentOptions {
  tenantId: string;
  contactPhone: string;
  messageId: string;
  providerMessageId: string;
}

export async function publishMessageSent(options: PublishMessageSentOptions): Promise<void> {
  await publishChatRealtimeEvent({
    type: "message.sent",
    tenant_id: options.tenantId,
    contact_phone: options.contactPhone,
    message_id: options.messageId,
    provider_message_id: options.providerMessageId,
    status: "sent",
  });
}

export interface PublishMessageStatusOptions {
  tenantId: string;
  contactPhone: string | null;
  messageId: string | null;
  providerMessageId: string;
  status: MessageStatus;
}

export async function publishMessageStatus(
  options: PublishMessageStatusOptions,
): Promise<void> {
  if (!options.messageId || !options.contactPhone) return;

  await publishChatRealtimeEvent({
    type: "message.status",
    tenant_id: options.tenantId,
    contact_phone: options.contactPhone,
    message_id: options.messageId,
    provider_message_id: options.providerMessageId,
    status: options.status,
  });
}

export interface PublishMessageFailedOptions {
  tenantId: string;
  contactPhone: string | null;
  messageId: string | null;
  providerMessageId: string;
}

export async function publishMessageFailed(
  options: PublishMessageFailedOptions,
): Promise<void> {
  if (!options.messageId || !options.contactPhone) return;

  await publishChatRealtimeEvent({
    type: "message.failed",
    tenant_id: options.tenantId,
    contact_phone: options.contactPhone,
    message_id: options.messageId,
    provider_message_id: options.providerMessageId,
    status: "failed",
  });
}
