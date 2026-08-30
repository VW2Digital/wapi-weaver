import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { dispatchInstagram } from "@/lib/chat-outbox.server";

export class InstagramOutboundAdapter implements IOutboundAdapter {
  readonly provider = "instagram" as const;

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    const result = await dispatchInstagram({
      id: context.messageId,
      tenant_id: context.tenantId,
      user_id: context.userId,
      message_id: context.messageId,
      channel: this.provider,
      recipient: context.contactPhone,
      provider_recipient_id: context.providerRecipientId ?? null,
      provider_account_id: context.providerAccountId ?? null,
      payload: context.payload,
      attempts: 0,
      max_attempts: 3,
    } as any);

    return {
      provider: this.provider,
      providerMessageId: result.providerMessageId,
      providerAccountId: result.providerAccountId,
      status: "sent",
      responsePayload: result.responsePayload,
    };
  }
}
