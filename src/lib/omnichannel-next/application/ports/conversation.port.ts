import type { Conversation } from "@/lib/omnichannel-next/domain/conversation";

export interface ConversationPort {
  getById(tenantId: string, conversationId: string): Promise<Conversation | null>;
}
