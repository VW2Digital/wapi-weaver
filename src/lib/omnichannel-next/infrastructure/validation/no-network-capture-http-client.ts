import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { HttpClientPort, HttpRequest, HttpResponse } from "@/lib/omnichannel-next/infrastructure/http";

export interface CapturedHttpDescriptor {
  method: string;
  url: string;
  host: string;
  path: string;
  graphVersion: string;
  senderNodeType: "phone_number_id";
  senderNode: string;
  recipient: string;
  messageType: string;
  authorization: "Bearer [REDACTED]";
  contentType: string;
}

export class NoNetworkCaptureHttpClient implements HttpClientPort {
  public networkAttempts = 0;
  private lastCaptured: CapturedHttpDescriptor | null = null;

  async request(req: HttpRequest): Promise<HttpResponse> {
    this.networkAttempts += 1;

    const auth = req.headers?.Authorization ?? req.headers?.authorization;
    if (!auth || !String(auth).startsWith("Bearer ")) {
      throw new OmnichannelError("DRY_RUN_AUTH_INVALID", "Dry-run request missing or invalid Authorization header");
    }

    const token = String(auth).slice(7).trim();
    if (!token) {
      throw new OmnichannelError("DRY_RUN_AUTH_EMPTY", "Dry-run request has empty Bearer token");
    }

    const url = new URL(req.url);
    const host = url.hostname;
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (host !== "graph.facebook.com" || pathParts.length !== 3 || pathParts[2] !== "messages") {
      throw new OmnichannelError("DRY_RUN_ENDPOINT_INVALID", "Dry-run request does not match expected WhatsApp Graph API endpoint");
    }

    const graphVersion = pathParts[0] ?? "unknown";
    const senderNode = pathParts[1] ?? "unknown";

    const body = req.body as { to?: string; type?: string } | undefined;
    const recipient = body?.to ?? "unknown";
    const messageType = body?.type ?? "unknown";

    this.lastCaptured = {
      method: req.method,
      url: `${url.protocol}//[REDACTED_HOST]${url.pathname}`,
      host: "graph.facebook.com",
      path: url.pathname,
      graphVersion,
      senderNodeType: "phone_number_id",
      senderNode,
      recipient,
      messageType,
      authorization: "Bearer [REDACTED]",
      contentType: String((req.headers ?? {})["Content-Type"] ?? (req.headers ?? {})["content-type"] ?? ""),
    };

    if (this.networkAttempts > 0) {
      // This client is a network kill switch: the synthetic success is returned,
      // but the attempt counter proves no real socket was used.
    }

    return {
      status: 200,
      body: { messages: [{ id: "wamid.DRY_RUN" }] } as unknown,
    };
  }

  captured(): CapturedHttpDescriptor | null {
    return this.lastCaptured;
  }
}
