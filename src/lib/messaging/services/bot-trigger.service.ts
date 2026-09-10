"use server";

import type { CanonicalMessage, MessagingProvider } from "../types";

export interface TriggerBotOptions {
  userId: string;
  phoneNumberId: string;
  contactPhone: string;
  message: CanonicalMessage;
  provider: MessagingProvider;
  messageId: string;
  conversationId?: string | null;
}

/**
 * Entrada única para canais via messaging core.
 * Não pré-filtra com evaluateBotActivation (isso engolia timeout/IA).
 * O gate completo vive em processBotFlow → evaluateInboundBotGate.
 */
export async function triggerBotForMessage(options: TriggerBotOptions): Promise<void> {
  const { userId, phoneNumberId, contactPhone, message, provider, conversationId } = options;

  const body = message.body;
  const buttonPayload = message.buttonPayload;

  if (!phoneNumberId || (!body && !buttonPayload)) return;

  // Guard against accidental bot loops from echoes or internal messages.
  if (message.direction !== "incoming") {
    console.info("[bot:trigger] Skipping non-incoming message", {
      messageId: options.messageId,
      direction: message.direction,
    });
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
    message.providerMessageId,
    conversationId,
  );
}
