export type { Provider } from "./domain/provider";
export type { MessageType, MediaReference, OutboundMessage } from "./domain/message-types";
export type { Conversation } from "./domain/conversation";
export type { Channel, ChannelStatus } from "./domain/channel";
export {
  OmnichannelError,
  ConversationNotFoundError,
  ChannelNotFoundError,
  TenantMismatchError,
  ChannelUnavailableError,
  ChannelConnectionRequiredError,
  UnsupportedProviderError,
  ProviderSendError,
} from "./domain/errors";

export type { SendMessageCommand } from "./application/commands/send-message.command";
export type { ConversationPort } from "./application/ports/conversation.port";
export type { ChannelPort } from "./application/ports/channel.port";
export type { MessageRepositoryPort, MessageRecord } from "./application/ports/message-repository.port";
export type { OutboundProviderPort, ProviderSendContext, ProviderSendResult } from "./application/ports/outbound-provider.port";
export type { ProviderRegistryPort } from "./application/ports/provider-registry.port";
export type { TransactionPort } from "./application/ports/transaction.port";

export { SendMessageService } from "./application/services/send-message.service";
export type { SendMessageResult } from "./application/services/send-message.result";
