import { randomUUID } from "node:crypto";
import type { OutboundMessage } from "@/lib/omnichannel-next/domain/message-types";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundJob } from "./outbound-job";

export interface OutboundJobContext {
  tenantId: string;
  messageId: string;
  conversationId: string;
  channelConnectionId: string;
  provider: Provider;
  recipient: string;
  message: OutboundMessage;
}

export class OutboundJobService {
  static build(context: OutboundJobContext): OutboundJob {
    return {
      id: randomUUID(),
      tenantId: context.tenantId,
      messageId: context.messageId,
      conversationId: context.conversationId,
      channelConnectionId: context.channelConnectionId,
      provider: context.provider,
      recipient: context.recipient,
      message: context.message,
      attempt: 0,
      createdAt: new Date().toISOString(),
    };
  }
}
