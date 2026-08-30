import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { ProviderSendContext } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type { WhatsAppChannelConfig, WhatsAppTransportRequest } from "./whatsapp.types";

export class WhatsAppMessageMapper {
  static toTransport(
    context: ProviderSendContext,
    config: WhatsAppChannelConfig,
  ): WhatsAppTransportRequest {
    if (context.message.type !== "text") {
      throw new OmnichannelError(
        "UNSUPPORTED_MESSAGE_TYPE",
        `WhatsApp mapper does not support ${context.message.type}`,
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
