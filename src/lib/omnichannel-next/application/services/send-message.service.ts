import { randomUUID } from "node:crypto";
import type { SendMessageCommand } from "../commands/send-message.command";
import {
  ConversationNotFoundError,
  ChannelNotFoundError,
  TenantMismatchError,
  ChannelUnavailableError,
  ChannelConnectionRequiredError,
  UnsupportedProviderError,
  ProviderSendError,
  OmnichannelError,
} from "@/lib/omnichannel-next/domain/errors";
import type { ConversationPort } from "../ports/conversation.port";
import type { ChannelPort } from "../ports/channel.port";
import type { MessageRepositoryPort } from "../ports/message-repository.port";
import type { ProviderRegistryPort } from "../ports/provider-registry.port";
import type { TransactionPort } from "../ports/transaction.port";
import type { ProviderSendResult } from "../ports/outbound-provider.port";
import type { SendMessageResult } from "./send-message.result";

export class SendMessageService {
  constructor(
    private readonly conversationPort: ConversationPort,
    private readonly channelPort: ChannelPort,
    private readonly messageRepository: MessageRepositoryPort,
    private readonly providerRegistry: ProviderRegistryPort,
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

    const providerPort = this.providerRegistry.get(channel.provider);
    if (providerPort.provider !== channel.provider) {
      throw new ProviderSendError(channel.provider, "Registry returned wrong provider adapter");
    }

    const messageId = randomUUID();
    let sendResult: ProviderSendResult;

    await this.transactionPort.run(async () => {
      await this.messageRepository.createPending({
        id: messageId,
        tenantId: command.tenantId,
        conversationId: conversation.id,
        channelConnectionId: channel.id,
        provider: channel.provider,
        message: command.message,
      });

      try {
        sendResult = await providerPort.send({
          tenantId: command.tenantId,
          conversationId: conversation.id,
          channelConnectionId: channel.id,
          messageId,
          provider: channel.provider,
          recipient: conversation.contactId,
          message: command.message,
        });
      } catch (e) {
        await this.messageRepository.markFailed(messageId);
        throw new ProviderSendError(
          channel.provider,
          e instanceof Error ? e.message : "Unknown provider error",
        );
      }

      if (!sendResult.providerMessageId) {
        await this.messageRepository.markFailed(messageId);
        throw new ProviderSendError(channel.provider, "Provider did not return a message id");
      }

      await this.messageRepository.markAccepted(messageId, sendResult.providerMessageId);
    });

    return {
      messageId,
      conversationId: conversation.id,
      channelConnectionId: channel.id,
      provider: channel.provider,
      providerMessageId: sendResult!.providerMessageId,
      status: "sent",
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
