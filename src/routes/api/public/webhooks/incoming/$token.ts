import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const incomingPayloadSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().min(8).max(32).optional(),
  company: z.string().max(255).optional(),
  position: z.string().max(255).optional(),
  external_id: z.string().max(255).optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
});

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    ...extra,
  };
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

export const Route = createFileRoute("/api/public/webhooks/incoming/$token")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: corsHeaders(),
        }),
      POST: async ({ request, params }) => {
        const { token } = params;
        const headers = corsHeaders();
        const startTime = Date.now();

        try {
          const {
            findIncomingWebhookByToken,
            logIncomingWebhookEvent,
            incrementIncomingWebhookStats,
            upsertContactFromWebhook,
            resolveDotPath,
            applyTransform,
          } = await import("@/lib/webhooks.server");

          // 1. Find webhook
          const webhook = await findIncomingWebhookByToken(token);
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

          // 2. Parse body
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return new Response(JSON.stringify({ error: "Payload JSON inválido" }), {
              status: 400,
              headers,
            });
          }

          const body = (rawBody ?? {}) as Record<string, any>;

          // 3. Idempotency check
          const idempotencyKey = request.headers.get("x-idempotency-key") ?? body.idempotency_key ?? null;
          if (idempotencyKey) {
            const db = (await import("@/lib/db")).default;
            const [existingEvent]: any = await db.query(
              "SELECT id, status FROM incoming_webhook_events WHERE incoming_webhook_id = ? AND idempotency_key = ? LIMIT 1",
              [webhook.id, idempotencyKey],
            );
            if (existingEvent?.length > 0) {
              return new Response(
                JSON.stringify({ ok: true, deduplicated: true, event_id: existingEvent[0].id }),
                { status: 200, headers },
              );
            }
          }

          // 4. Load field mappings
          let mappings: any[] = [];
          try {
            if (webhook.field_labels && webhook.field_labels !== "null") {
              const parsed = typeof webhook.field_labels === "string"
                ? JSON.parse(webhook.field_labels)
                : webhook.field_labels;
              mappings = Object.entries(parsed).map(([key]) => ({
                external_field: key,
                target_type: "ignore",
                target_field: "",
                transform: "",
              }));
            }
          } catch {}

          // Try to get proper mappings from webhook_field_mappings if available
          const dbMod = await import("@/lib/db");
          try {
            const [rows]: any = await dbMod.default.query(
              "SELECT * FROM webhook_field_mappings WHERE webhook_id = ? ORDER BY sort_order ASC",
              [webhook.id],
            );
            if (rows?.length > 0) mappings = rows;
          } catch {}

          // 5. Apply mappings to extract fields
          const mappedStandardFields: Record<string, unknown> = {};
          const mappedCustomFields: Record<string, unknown> = {};
          const unmappedFields: string[] = [];
          const knownKeys = new Set<string>();

          const stdFieldMap: Record<string, string> = {
            name: "name", email: "email", phone: "phone", company: "company",
            position: "position", external_id: "external_id",
          };

          // Collect all top-level keys in payload
          const allPayloadKeys = new Set<string>();
          Object.keys(body).forEach((k) => allPayloadKeys.add(k));

          for (const mapping of mappings) {
            const extField = mapping.external_field;
            knownKeys.add(extField);
            allPayloadKeys.delete(extField);

            const rawValue = resolveDotPath(body, extField);
            if (rawValue === undefined) continue;

            const transformedValue = mapping.transform ? applyTransform(rawValue, mapping.transform) : rawValue;

            if (mapping.target_type === "standard") {
              const targetStd = stdFieldMap[mapping.target_field];
              if (targetStd) {
                mappedStandardFields[mapping.target_field] = transformedValue;
              }
            } else if (mapping.target_type === "custom") {
              mappedCustomFields[mapping.target_field] = transformedValue;
            }
          }

          // Remaining unknown keys as unmapped
          allPayloadKeys.forEach((k) => { if (k !== "custom_fields") unmappedFields.push(k); });

          // 6. Validate extracted data
          const phone = mappedStandardFields.phone as string ?? body.phone ?? null;
          const email = mappedStandardFields.email as string ?? body.email ?? null;
          const external_id = mappedStandardFields.external_id as string ?? body.external_id ?? null;

          if (!phone && !email && !external_id) {
            const errMsg = "É necessário fornecer 'phone', 'email' ou 'external_id'";
            await logIncomingWebhookEvent(webhook.id, body, "error", errMsg, {
              mappedStandardFields,
              mappedCustomFields,
              unmappedFields,
              headers: Object.fromEntries(request.headers),
              ipAddress: getClientIp(request),
              userAgent: request.headers.get("user-agent") ?? undefined,
              processingDurationMs: Date.now() - startTime,
              idempotencyKey: idempotencyKey ?? undefined,
            });
            await incrementIncomingWebhookStats(webhook.id, false);
            return new Response(JSON.stringify({ error: errMsg }), { status: 400, headers });
          }

          // 7. Create or update contact
          try {
            const contact = await upsertContactFromWebhook(
              webhook.tenant_id,
              {
                name: (mappedStandardFields.name as string) ?? body.name ?? undefined,
                email: email ?? undefined,
                phone: phone ?? undefined,
                company: (mappedStandardFields.company as string) ?? body.company ?? undefined,
                position: (mappedStandardFields.position as string) ?? body.position ?? undefined,
                external_id: external_id ?? body.external_id ?? undefined,
                custom_fields: body.custom_fields as Record<string, unknown> ?? undefined,
              },
              { id: webhook.id, name: webhook.name },
            );

            // Save custom field values from mappings
            if (Object.keys(mappedCustomFields).length > 0) {
              try {
                const { saveContactCustomFieldValues } = await import("@/lib/custom-fields.functions");
                await saveContactCustomFieldValues({
                  data: {
                    contact_id: contact.id,
                    values: Object.entries(mappedCustomFields).map(([custom_field_id, value]) => ({
                      custom_field_id,
                      value,
                    })),
                  },
                });
              } catch {}
            }

            await logIncomingWebhookEvent(webhook.id, body, "success", undefined, {
              mappedStandardFields,
              mappedCustomFields,
              unmappedFields,
              headers: Object.fromEntries(request.headers),
              ipAddress: getClientIp(request),
              userAgent: request.headers.get("user-agent") ?? undefined,
              processingDurationMs: Date.now() - startTime,
              idempotencyKey: idempotencyKey ?? undefined,
            });
            await incrementIncomingWebhookStats(webhook.id, contact.created, contact.id);

            try {
              const { triggerWebhookBotFlow } = await import("@/lib/botflow-executor.server");
              triggerWebhookBotFlow(webhook.tenant_id, contact.id, body).catch((err) => {
                console.error("[Webhook Trigger] Error calling triggerWebhookBotFlow:", err);
              });
            } catch (err) {
              console.error("[Webhook Trigger] Error importing triggerWebhookBotFlow:", err);
            }

            return new Response(
              JSON.stringify({
                ok: true,
                contact_id: contact.id,
                created: contact.created,
              }),
              { status: 200, headers },
            );
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await logIncomingWebhookEvent(webhook.id, body, "error", errorMessage, {
              mappedStandardFields,
              mappedCustomFields,
              unmappedFields,
              headers: Object.fromEntries(request.headers),
              ipAddress: getClientIp(request),
              userAgent: request.headers.get("user-agent") ?? undefined,
              processingDurationMs: Date.now() - startTime,
              idempotencyKey: idempotencyKey ?? undefined,
            });
            await incrementIncomingWebhookStats(webhook.id, false);
            return new Response(JSON.stringify({ error: errorMessage }), { status: 400, headers });
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: "Erro interno", detail: errorMessage }), {
            status: 500,
            headers,
          });
        }
      },
    },
  },
});
