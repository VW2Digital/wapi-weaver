"use server";

import type { CanonicalMessage, MessagingProvider } from "../types";
import { getBotActivationContext, evaluateBotActivation } from "./bot-lifecycle.service";

export interface TriggerBotOptions {
  userId: string;
  phoneNumberId: string;
  contactPhone: string;
  message: CanonicalMessage;
  provider: MessagingProvider;
  messageId: string;
  conversationId?: string | null;
}

export async function triggerBotForMessage(options: TriggerBotOptions): Promise<void> {
  const { userId, phoneNumberId, contactPhone, message, provider, messageId, conversationId } = options;

  const body = message.body;
  const buttonPayload = message.buttonPayload;

  if (!phoneNumberId || (!body && !buttonPayload)) return;

  // Guard against accidental bot loops from echoes or internal messages.
  if (message.direction !== "incoming") {
    console.info("[bot:trigger] Skipping non-incoming message", { messageId, direction: message.direction });
    return;
  }

  const channel = provider;
  const context = await getBotActivationContext(userId, channel, contactPhone);
  const decision = evaluateBotActivation(context);

  if (!decision.active) {
    console.info("[bot:trigger] Skipping bot execution", { messageId, userId, channel, contactPhone, reason: decision.reason });
    return;
  }

  const { processBotFlow } = await import("@/lib/botflow-executor.server");

  await processBotFlow(
    body || buttonPayload || "Mensagem",
    contactPhone,
    phoneNumberId,
    userId,
    buttonPayload ?? undefined,
    provider,
    messageId,
    conversationId,
  );
}
