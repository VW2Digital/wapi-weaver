"use server";

import { buildWhatsAppOutboundPayload } from "./whatsapp.payload-builder";
import type { ChatProviderPayload } from "@/lib/chat-outbox.server";

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
}

export interface WhatsAppSendInput {
  recipient: string;
  payload: ChatProviderPayload;
}

export interface WhatsAppSendResult {
  providerMessageId: string | null;
  responsePayload: unknown;
}

export class WhatsAppClient {
  constructor(private readonly credentials: WhatsAppCredentials) {}

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const payload = buildWhatsAppOutboundPayload(input.recipient, input.payload);

    const url = `https://graph.facebook.com/${this.credentials.graphVersion}/${this.credentials.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const body = text ? safeJsonParse(text) : {};

    if (!response.ok) {
      throw new WhatsAppClientError(response.status, body);
    }

    const messages = (body as any)?.messages;
    const providerMessageId =
      typeof messages?.[0]?.id === "string" ? messages[0].id : null;

    return {
      providerMessageId,
      responsePayload: body,
    };
  }
}

export class WhatsAppClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`WhatsApp client error: ${status}`);
    this.name = "WhatsAppClientError";
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 4000) };
  }
}
