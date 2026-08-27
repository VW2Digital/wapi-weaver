"use server";

import type { CanonicalMessage, MessagingProvider } from "../types";

export interface TriggerBotOptions {
  userId: string;
  phoneNumberId: string;
  contactPhone: string;
  message: CanonicalMessage;
  provider: MessagingProvider;
  messageId: string;
}

export async function triggerBotForMessage(options: TriggerBotOptions): Promise<void> {
  const { userId, phoneNumberId, contactPhone, message, provider, messageId } = options;

  const body = message.body;
  const buttonPayload = message.buttonPayload;

  if (!phoneNumberId || (!body && !buttonPayload)) return;

  const { processBotFlow } = await import("@/lib/botflow-executor.server");

  await processBotFlow(
    body || buttonPayload || "Mensagem",
    contactPhone,
    phoneNumberId,
    userId,
    buttonPayload ?? undefined,
    provider,
    messageId,
  );
}
