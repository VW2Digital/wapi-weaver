import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { HttpClientPort, HttpRequest, HttpResponse } from "./";

export class FetchHttpClient implements HttpClientPort {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const url = new URL(req.url);
    if (url.hostname !== "graph.facebook.com") {
      throw new OmnichannelError("HTTP_CLIENT_HOST_NOT_ALLOWED", `Host ${url.hostname} is not on allowlist`);
    }

    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    return { status: response.status, body };
  }
}
