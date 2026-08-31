"use server";

import { randomUUID } from "crypto";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";

export class WebChatOutboundAdapter implements IOutboundAdapter {
  readonly provider = "webchat" as const;

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    const providerMessageId = randomUUID();

    console.info("[WebChat Outbound] recorded", {
      tenantId: context.tenantId,
      messageId: context.messageId,
      providerMessageId,
      contactPhone: context.contactPhone,
      body: context.payload?.text?.body?.slice(0, 100),
    });

    return {
      provider: this.provider,
      providerMessageId,
      providerAccountId: context.channelConnectionId ?? null,
      status: "sent",
      responsePayload: { recorded: true },
    };
  }
}
