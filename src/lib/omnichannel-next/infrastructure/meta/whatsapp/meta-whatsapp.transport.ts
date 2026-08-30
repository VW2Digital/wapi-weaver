import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { WhatsAppTransportPort } from "@/lib/omnichannel-next/providers/whatsapp";
import type { WhatsAppTransportRequest, WhatsAppTransportResult } from "@/lib/omnichannel-next/providers/whatsapp/whatsapp.types";
import type { HttpClientPort } from "@/lib/omnichannel-next/infrastructure/http";
import type { CredentialResolverPort } from "@/lib/omnichannel-next/infrastructure/http";
import { MetaWhatsAppTransportError } from "./meta-whatsapp.errors";

export interface WhatsAppMetaTransportConfig {
  graphApiVersion: string;
  graphHost?: string;
}

interface WhatsAppSendResponse {
  messages?: { id: string }[];
  error?: { code: number; message: string };
}

export class MetaWhatsAppTransport implements WhatsAppTransportPort {
  private readonly graphHost: string;

  constructor(
    private readonly config: WhatsAppMetaTransportConfig,
    private readonly http: HttpClientPort,
    private readonly credentials: CredentialResolverPort,
  ) {
    this.graphHost = config.graphHost ?? "graph.facebook.com";
  }

  async send(request: WhatsAppTransportRequest): Promise<WhatsAppTransportResult> {
    const credential = await this.credentials.resolve(request.credentialReference);
    const url = `https://${this.graphHost}/v${this.config.graphApiVersion}/${request.sender}/messages`;

    const httpResponse = await this.http.request({
      method: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential.token}`,
      },
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: request.recipient,
        type: "text",
        text: {
          preview_url: false,
          body: request.message.text,
        },
      },
    });

    if (httpResponse.status >= 200 && httpResponse.status < 300) {
      const body = httpResponse.body as WhatsAppSendResponse;
      const messageId = body.messages?.[0]?.id;
      if (!messageId) {
        throw new OmnichannelError(
          "WHATSAPP_MISSING_MESSAGE_ID",
          "WhatsApp API response did not include a message id",
        );
      }
      return { providerMessageId: messageId };
    }

    const body = (httpResponse.body ?? {}) as { error?: { code: number; message: string } };
    throw this.normalizeError(httpResponse.status, body.error);
  }

  private normalizeError(
    status: number,
    error?: { code: number; message: string },
  ): MetaWhatsAppTransportError {
    const retryable = status >= 500 || status === 429;
    const safeCode = `META_WHATSAPP_${status}`;

    const message = `WhatsApp transport failed with HTTP ${status}: ${error?.message ?? "unknown error"}`;
    return new MetaWhatsAppTransportError(
      `${safeCode}: ${message}`,
      {
        provider: "whatsapp",
        safeCode,
        httpStatus: status,
        retryable,
        metaCode: error?.code?.toString(),
        metaMessage: error?.message,
      },
    );
  }
}
