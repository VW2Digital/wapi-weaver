import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type {
  OutboundProviderPort,
  ProviderSendContext,
  ProviderSendResult,
} from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import { WHATSAPP_CAPABILITIES } from "./whatsapp.capabilities";
import { WhatsAppMessageMapper } from "./whatsapp.message-mapper";
import type { WhatsAppChannelConfigPort } from "./ports/whatsapp-channel-config.port";
import type { WhatsAppTransportPort } from "./ports/whatsapp-transport.port";

export class WhatsAppProvider implements OutboundProviderPort {
  readonly provider: Provider = "whatsapp";

  constructor(
    private readonly configPort: WhatsAppChannelConfigPort,
    private readonly transportPort: WhatsAppTransportPort,
  ) {}

  async send(context: ProviderSendContext): Promise<ProviderSendResult> {
    if (context.provider && context.provider !== this.provider) {
      throw new OmnichannelError(
        "PROVIDER_MISMATCH",
        `Expected provider ${this.provider}, received ${context.provider}`,
      );
    }

    const capability = WHATSAPP_CAPABILITIES[context.message.type];
    if (!capability?.implemented) {
      throw new OmnichannelError(
        "UNSUPPORTED_MESSAGE_TYPE",
        `WhatsApp does not support ${context.message.type} in this architecture yet`,
      );
    }

    const config = await this.configPort.resolve(
      context.tenantId,
      context.channelConnectionId,
    );

    const request = WhatsAppMessageMapper.toTransport(context, config);
    const result = await this.transportPort.send(request);

    return {
      providerMessageId: result.providerMessageId,
      status: "sent",
    };
  }
}
