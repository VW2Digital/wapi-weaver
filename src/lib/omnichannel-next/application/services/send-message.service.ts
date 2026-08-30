import { randomUUID } from "node:crypto";
import type { SendMessageCommand } from "../commands/send-message.command";
import {
  ConversationNotFoundError,
  ChannelNotFoundError,
  TenantMismatchError,
  ChannelUnavailableError,
  ChannelConnectionRequiredError,
  OmnichannelError,
} from "@/lib/omnichannel-next/domain/errors";
import type { ConversationPort } from "../ports/conversation.port";
import type { ChannelPort } from "../ports/channel.port";
import type { MessageRepositoryPort } from "../ports/message-repository.port";
import type { TransactionPort } from "../ports/transaction.port";
import type { OutboundJobPort } from "@/lib/omnichannel-next/application/outbox/outbound-job.port";
import { OutboundJobService } from "@/lib/omnichannel-next/application/outbox/outbound-job.service";
import type { SendMessageResult } from "./send-message.result";

export class SendMessageService {
  constructor(
    private readonly conversationPort: ConversationPort,
    private readonly channelPort: ChannelPort,
    private readonly messageRepository: MessageRepositoryPort,
    private readonly outboundJobPort: OutboundJobPort,
    private readonly transactionPort: TransactionPort,
  ) {}

  async execute(command: SendMessageCommand): Promise<SendMessageResult> {
    this.validate(command);

    const conversation = await this.conversationPort.getById(
      command.tenantId,
      command.conversationId,
    );
    if (!conversation) {
      throw new ConversationNotFoundError(command.conversationId);
    }
    if (conversation.tenantId !== command.tenantId) {
      throw new TenantMismatchError();
    }
    if (!conversation.channelConnectionId) {
      throw new ChannelConnectionRequiredError();
    }

    const channel = await this.channelPort.getById(
      command.tenantId,
      conversation.channelConnectionId,
    );
    if (!channel) {
      throw new ChannelNotFoundError(conversation.channelConnectionId);
    }
    if (channel.tenantId !== command.tenantId) {
      throw new TenantMismatchError();
    }
    if (channel.status !== "active") {
      throw new ChannelUnavailableError();
    }

    const messageId = randomUUID();

    const job = OutboundJobService.build({
      tenantId: command.tenantId,
      messageId,
      conversationId: conversation.id,
      channelConnectionId: channel.id,
      provider: channel.provider,
      recipient: conversation.contactId,
      message: command.message,
    });

    await this.transactionPort.run(async () => {
      await this.messageRepository.createPending({
        id: messageId,
        tenantId: command.tenantId,
        conversationId: conversation.id,
        channelConnectionId: channel.id,
        provider: channel.provider,
        message: command.message,
      });

      await this.messageRepository.markQueued(messageId);
      await this.outboundJobPort.enqueue(job);
    });

    return {
      messageId,
      conversationId: conversation.id,
      channelConnectionId: channel.id,
      provider: channel.provider,
      status: "queued",
    };
  }

  private validate(command: SendMessageCommand): void {
    if (!command.tenantId?.trim()) {
      throw new OmnichannelError("INVALID_TENANT", "tenantId is required");
    }
    if (!command.conversationId?.trim()) {
      throw new OmnichannelError("INVALID_CONVERSATION", "conversationId is required");
    }
    if (!command.message) {
      throw new OmnichannelError("INVALID_MESSAGE", "message is required");
    }
    if (!command.message.type) {
      throw new OmnichannelError("INVALID_MESSAGE", "message.type is required");
    }
  }
}
