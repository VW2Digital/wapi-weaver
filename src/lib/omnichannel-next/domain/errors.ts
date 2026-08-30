export class OmnichannelError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OmnichannelError";
  }
}

export class ConversationNotFoundError extends OmnichannelError {
  constructor(conversationId: string) {
    super("CONVERSATION_NOT_FOUND", `Conversation ${conversationId} not found.`);
  }
}

export class ChannelNotFoundError extends OmnichannelError {
  constructor(channelConnectionId: string) {
    super("CHANNEL_NOT_FOUND", `Channel ${channelConnectionId} not found.`);
  }
}

export class TenantMismatchError extends OmnichannelError {
  constructor() {
    super("TENANT_MISMATCH", "Resource does not belong to the tenant.");
  }
}

export class ChannelUnavailableError extends OmnichannelError {
  constructor() {
    super("CHANNEL_UNAVAILABLE", "Channel is not available for sending.");
  }
}

export class ChannelConnectionRequiredError extends OmnichannelError {
  constructor() {
    super("CHANNEL_CONNECTION_REQUIRED", "Conversation has no channel connection.");
  }
}

export class UnsupportedProviderError extends OmnichannelError {
  constructor(provider: string) {
    super("UNSUPPORTED_PROVIDER", `Provider ${provider} is not supported.`);
  }
}

export class ProviderSendError extends OmnichannelError {
  constructor(provider: string, message: string) {
    super("PROVIDER_SEND_ERROR", `Provider ${provider} failed: ${message}`);
  }
}
