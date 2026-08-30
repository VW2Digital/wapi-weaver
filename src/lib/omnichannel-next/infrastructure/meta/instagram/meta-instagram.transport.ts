import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { InstagramTransportPort } from "@/lib/omnichannel-next/providers/instagram";
import type { InstagramTransportRequest, InstagramTransportResult } from "@/lib/omnichannel-next/providers/instagram/instagram.types";
import type { HttpClientPort } from "@/lib/omnichannel-next/infrastructure/http";
import type { CredentialResolverPort } from "@/lib/omnichannel-next/infrastructure/http";
import { MetaInstagramTransportError } from "./meta-instagram.errors";

export interface InstagramMetaTransportConfig {
  graphApiVersion: string;
  graphHost?: string;
}

interface InstagramSendResponse {
  message_id?: string;
  recipient_id?: string;
  error?: { code: number; message: string };
}

export class MetaInstagramTransport implements InstagramTransportPort {
  private readonly graphHost: string;

  constructor(
    private readonly config: InstagramMetaTransportConfig,
    private readonly http: HttpClientPort,
    private readonly credentials: CredentialResolverPort,
  ) {
    this.graphHost = config.graphHost ?? "graph.instagram.com";
  }

  async send(request: InstagramTransportRequest): Promise<InstagramTransportResult> {
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
        recipient: { id: request.recipient },
        message: { text: request.message.text },
      },
    });

    if (httpResponse.status >= 200 && httpResponse.status < 300) {
      const body = httpResponse.body as InstagramSendResponse;
      const messageId = body.message_id;
      if (!messageId) {
        throw new OmnichannelError(
          "INSTAGRAM_MISSING_MESSAGE_ID",
          "Instagram API response did not include a message id",
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
  ): MetaInstagramTransportError {
    const retryable = status >= 500 || status === 429;
    const safeCode = `META_INSTAGRAM_${status}`;

    const message = `Instagram transport failed with HTTP ${status}: ${error?.message ?? "unknown error"}`;
    return new MetaInstagramTransportError(
      `${safeCode}: ${message}`,
      {
        provider: "instagram",
        safeCode,
        httpStatus: status,
        retryable,
        metaCode: error?.code?.toString(),
        metaMessage: error?.message,
      },
    );
  }
}
