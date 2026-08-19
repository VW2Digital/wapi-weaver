import { createFileRoute } from "@tanstack/react-router";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, X-Idempotency-Key",
    "Content-Type": "application/json",
  };
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function normalizeBody(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (Array.isArray(value)) value = value[0];
  if (value && typeof value === "object" && !Array.isArray(value) && "body" in value) {
    const nested = (value as Record<string, unknown>).body;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) value = nested;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key.trim().toLowerCase(), fieldValue]),
  );
}

async function parsePayload(request: Request): Promise<{
  body: Record<string, unknown>;
  status: "received" | "parse_error";
  error?: string;
}> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const rawText = await request
    .clone()
    .text()
    .catch(() => "");
  try {
    if (contentType.includes("application/json")) {
      return { body: normalizeBody(JSON.parse(rawText)), status: "received" };
    }
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      return {
        body: normalizeBody(
          Object.fromEntries(
            Array.from(form.entries(), ([key, value]) => [
              key,
              typeof value === "string" ? value : value.name,
            ]),
          ),
        ),
        status: "received",
      };
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return {
        body: normalizeBody(Object.fromEntries(new URLSearchParams(rawText))),
        status: "received",
      };
    }
    try {
      return { body: normalizeBody(JSON.parse(rawText)), status: "received" };
    } catch {
      const params = new URLSearchParams(rawText);
      if (rawText.includes("=") && Array.from(params.keys()).length) {
        return { body: normalizeBody(Object.fromEntries(params)), status: "received" };
      }
      return {
        body: { raw_body: rawText },
        status: "parse_error",
        error: "Formato do payload não reconhecido",
      };
    }
  } catch (error) {
    return {
      body: { raw_body: rawText },
      status: "parse_error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const Route = createFileRoute("/api/public/webhooks/incoming/$token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request, params }) => {
        const headers = corsHeaders();
        const { findIncomingWebhookByToken, logIncomingWebhookEvent, processWebhookPayloadAsync } =
          await import("@/lib/webhooks.server");
        const webhook = await findIncomingWebhookByToken(params.token);
        if (!webhook) {
          return new Response(JSON.stringify({ error: "Webhook não encontrado" }), {
            status: 404,
            headers,
          });
        }
        if (webhook.status === "paused") {
          return new Response(JSON.stringify({ error: "Webhook está pausado" }), {
            status: 403,
            headers,
          });
        }

        const parsed = await parsePayload(request);
        const idempotencyKey =
          request.headers.get("x-idempotency-key") ??
          (parsed.body.idempotency_key == null ? null : String(parsed.body.idempotency_key));
        if (idempotencyKey) {
          const db = (await import("@/lib/db")).default;
          const existing = await db
            .query<
              Array<{ id: string | number }>
            >("SELECT id FROM incoming_webhook_events WHERE incoming_webhook_id = ? AND idempotency_key = ? LIMIT 1", [webhook.id, idempotencyKey])
            .catch(() => []);
          if (existing[0]) {
            return new Response(JSON.stringify({ ok: true, event_id: String(existing[0].id) }), {
              status: 200,
              headers,
            });
          }
        }

        let eventId: string;
        try {
          eventId = await logIncomingWebhookEvent(
            webhook.id,
            parsed.body,
            parsed.status,
            parsed.error,
            {
              headers: Object.fromEntries(request.headers.entries()),
              ipAddress: getClientIp(request),
              userAgent: request.headers.get("user-agent") ?? undefined,
              idempotencyKey: idempotencyKey ?? undefined,
            },
          );
        } catch (error) {
          console.error("[Webhook] Falha ao persistir evento:", error);
          return new Response(JSON.stringify({ error: "Falha ao persistir webhook" }), {
            status: 500,
            headers,
          });
        }

        if (parsed.status === "received") {
          setTimeout(() => void processWebhookPayloadAsync(webhook, eventId, parsed.body), 0);
        }
        return new Response(JSON.stringify({ ok: true, event_id: eventId }), {
          status: 200,
          headers,
        });
      },
    },
  },
});
