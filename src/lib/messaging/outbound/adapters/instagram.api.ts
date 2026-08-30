"use server";

import type { InstagramSendPayload } from "./instagram.payload-builder";

export function buildInstagramGraphUrl(
  nodeId: string,
  path = "",
  configuredVersion = process.env.META_GRAPH_VERSION || "v26.0",
) {
  const apiVersion = configuredVersion.startsWith("v")
    ? configuredVersion
    : `v${configuredVersion}`;
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(nodeId)}${suffix}`;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface InstagramCredentials {
  igUserId: string;
  accessToken: string;
  graphVersion?: string;
}

export interface InstagramSendInput {
  payload: InstagramSendPayload;
}

export interface InstagramSendResult {
  providerMessageId: string | null;
  body: unknown;
  retries: number;
}

export class InstagramClient {
  constructor(private readonly credentials: InstagramCredentials) {}

  async send(input: InstagramSendInput): Promise<InstagramSendResult> {
    const url = buildInstagramGraphUrl(this.credentials.igUserId, "messages", this.credentials.graphVersion);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Instagram API] Sending message (Attempt ${attempt})`, {
          url,
          type: this.inferType(input.payload),
        });

        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.credentials.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input.payload),
        });

        const body = await safeJsonParse(r);

        if (r.ok) {
          console.log("[Instagram API] Message sent successfully", { message_id: (body as any)?.message_id });
          return {
            providerMessageId: (body as any)?.message_id || null,
            body,
            retries: attempt - 1,
          };
        }

        const isRateLimit = r.status === 429 || [4, 17, 32, 613].includes((body as any)?.error?.code);
        const isServerError = r.status >= 500;

        if ((isRateLimit || isServerError) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          console.error(`[Instagram API] Rate limit or server error. Retrying in ${delay}ms...`, body);
          await sleep(delay);
          continue;
        }

        console.error(`[Instagram API] Failed after ${attempt} attempts`, body);
        throw new InstagramClientError(r.status, body);
      } catch (e: any) {
        if (attempt < MAX_RETRIES && !e?.status) {
          const delay = BASE_DELAY * Math.pow(2, attempt - 1);
          console.error(`[Instagram API] Network error. Retrying in ${delay}ms...`, e.message);
          await sleep(delay);
          continue;
        }

        if (e instanceof InstagramClientError) throw e;
        throw new InstagramClientError(0, { error: e.message || "Network error" });
      }
    }

    throw new InstagramClientError(0, { error: "Retries exhausted" });
  }

  private inferType(payload: InstagramSendPayload): string {
    if (payload.message?.text) return "text";
    if (payload.message?.attachment) return (payload.message.attachment as any)?.type || "media";
    if (payload.sender_action) return "reaction";
    return "unknown";
  }
}

export class InstagramClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Instagram client error: ${status}`);
    this.name = "InstagramClientError";
  }
}

async function safeJsonParse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 4000) };
  }
}
