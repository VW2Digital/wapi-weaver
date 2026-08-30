import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type {
  OutboundProviderPort,
  ProviderSendContext,
  ProviderSendResult,
} from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import { INSTAGRAM_CAPABILITIES } from "./instagram.capabilities";
import { InstagramMessageMapper } from "./instagram.message-mapper";
import type { InstagramChannelConfigPort } from "./ports/instagram-channel-config.port";
import type { InstagramTransportPort } from "./ports/instagram-transport.port";

export class InstagramProvider implements OutboundProviderPort {
  readonly provider: Provider = "instagram";

  constructor(
    private readonly configPort: InstagramChannelConfigPort,
    private readonly transportPort: InstagramTransportPort,
  ) {}

  async send(context: ProviderSendContext): Promise<ProviderSendResult> {
    if (context.provider && context.provider !== this.provider) {
      throw new OmnichannelError(
        "PROVIDER_MISMATCH",
        `Expected provider ${this.provider}, received ${context.provider}`,
      );
    }

    const capability = INSTAGRAM_CAPABILITIES[context.message.type];
    if (!capability?.implemented) {
      throw new OmnichannelError(
        "UNSUPPORTED_MESSAGE_TYPE",
        `Instagram does not support ${context.message.type} in this architecture yet`,
      );
    }

    const config = await this.configPort.resolve(
      context.tenantId,
      context.channelConnectionId,
    );

    const request = InstagramMessageMapper.toTransport(context, config);
    const result = await this.transportPort.send(request);

    return {
      providerMessageId: result.providerMessageId,
      status: "sent",
    };
  }
}
