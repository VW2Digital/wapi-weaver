import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { HttpClientPort, HttpRequest, HttpResponse } from "@/lib/omnichannel-next/infrastructure/http";
import type { CapturedHttpDescriptor } from "./no-network-capture-http-client";

export interface SingleShotMetaHttpClientResult {
  status: number;
  metaAccepted: boolean;
  providerMessageId?: string;
  metaErrorCode?: number;
  metaErrorMessage?: string;
}

export class SingleShotMetaHttpClient implements HttpClientPort {
  public networkAttempts = 0;
  public sentRequests = 0;
  private used = false;
  private capturedDescriptor: CapturedHttpDescriptor | null = null;
  private lastResult: SingleShotMetaHttpClientResult | null = null;

  constructor(
    private readonly phoneNumberId: string,
    private readonly graphApiVersion: string,
    private readonly controlledRecipient: string,
    private readonly timeoutMs: number = 30_000,
  ) {}

  async request(req: HttpRequest): Promise<HttpResponse> {
    this.networkAttempts += 1;

    if (this.used) {
      throw new OmnichannelError("SINGLE_SHOT_BLOCKED", "Second request blocked; single-shot limit reached");
    }
    this.used = true;

    const auth = req.headers?.Authorization ?? req.headers?.authorization;
    if (!auth || !String(auth).startsWith("Bearer ")) {
      throw new OmnichannelError("DRY_RUN_AUTH_INVALID", "Request missing or invalid Authorization header");
    }

    const token = String(auth).slice(7).trim();
    if (!token) {
      throw new OmnichannelError("DRY_RUN_AUTH_EMPTY", "Request has empty Bearer token");
    }

    const url = new URL(req.url);
    const host = url.hostname;
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (host !== "graph.facebook.com") {
      throw new OmnichannelError("SINGLE_SHOT_HOST_INVALID", "Host is not on allowlist");
    }

    if (pathParts.length !== 3 || pathParts[2] !== "messages") {
      throw new OmnichannelError("SINGLE_SHOT_PATH_INVALID", "Path does not match WhatsApp messages endpoint");
    }

    const version = pathParts[0] ?? "unknown";
    const sender = pathParts[1] ?? "unknown";

    if (sender !== this.phoneNumberId) {
      throw new OmnichannelError("SINGLE_SHOT_SENDER_MISMATCH", "Sender phone number id does not match resolved channel");
    }

    if (version.replace(/^v/i, "") !== this.graphApiVersion.replace(/^v/i, "")) {
      throw new OmnichannelError("SINGLE_SHOT_VERSION_MISMATCH", "Graph API version does not match resolved config");
    }

    const body = req.body as { to?: string } | undefined;
    if (!body || body.to !== this.controlledRecipient) {
      throw new OmnichannelError("SINGLE_SHOT_RECIPIENT_MISMATCH", "Recipient does not match the controlled test recipient");
    }

    this.capturedDescriptor = {
      method: req.method,
      url: `https://[REDACTED_HOST]/v${this.graphApiVersion.replace(/^v/i, "")}/[MASKED]/messages`,
      host: "graph.facebook.com",
      path: `/v${this.graphApiVersion.replace(/^v/i, "")}/[MASKED]/messages`,
      graphVersion: `v${this.graphApiVersion.replace(/^v/i, "")}`,
      senderNodeType: "phone_number_id",
      senderNode: "[MASKED]",
      recipient: maskRecipient(this.controlledRecipient),
      messageType: "text",
      authorization: "Bearer [REDACTED]",
      contentType: String((req.headers ?? {})["Content-Type"] ?? (req.headers ?? {})["content-type"] ?? ""),
    };

    this.sentRequests += 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.body ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
        redirect: "error",
      });

      let bodyJson: unknown;
      try {
        bodyJson = await response.json();
      } catch {
        bodyJson = {};
      }

      const metaBody = bodyJson as { messages?: { id: string }[]; error?: { code: number; message: string } };
      const providerMessageId = metaBody.messages?.[0]?.id;
      const metaError = metaBody.error;

      this.lastResult = {
        status: response.status,
        metaAccepted: response.status >= 200 && response.status < 300 && !!providerMessageId,
        providerMessageId,
        metaErrorCode: metaError?.code,
        metaErrorMessage: metaError?.message,
      };

      return { status: response.status, body: bodyJson };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new OmnichannelError("SINGLE_SHOT_TIMEOUT", "WhatsApp smoke request timed out");
      }
      throw new OmnichannelError("SINGLE_SHOT_NETWORK_ERROR", "WhatsApp smoke request failed before response");
    } finally {
      clearTimeout(timer);
    }
  }

  captured(): CapturedHttpDescriptor | null {
    return this.capturedDescriptor;
  }

  result(): SingleShotMetaHttpClientResult | null {
    return this.lastResult;
  }
}

function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) return "[MASKED]";
  return `${recipient.slice(0, -4).replace(/./g, "*")}${recipient.slice(-4)}`;
}
