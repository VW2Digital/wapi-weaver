import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { ProviderSendContext } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type { InstagramChannelConfig, InstagramTransportRequest } from "./instagram.types";

export class InstagramMessageMapper {
  static toTransport(
    context: ProviderSendContext,
    config: InstagramChannelConfig,
  ): InstagramTransportRequest {
    if (context.message.type !== "text") {
      throw new OmnichannelError(
        "UNSUPPORTED_MESSAGE_TYPE",
        `Instagram mapper does not support ${context.message.type}`,
      );
    }

    return {
      recipient: context.recipient ?? "unknown",
      sender: config.senderIdentifier,
      credentialReference: config.credentialReference,
      message: {
        type: "text",
        text: context.message.text ?? "",
      },
    };
  }
}
