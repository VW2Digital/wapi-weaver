import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
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

          // Garante que as colunas mais recentes existem (last_contact_id, contact_id)
          const { ensureWebhookTables } = await import("@/lib/webhooks.functions");
          await ensureWebhookTables().catch(() => {});

          // 1. Encontrar o webhook no MySQL
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

          // 2. Tratar Payload — suporta JSON, application/x-www-form-urlencoded e multipart/form-data
          //    Webflow, Wix e formulários HTML nativos enviam form-urlencoded por padrão.
          let rawBody: unknown;
          const contentType = request.headers.get("content-type") ?? "";

          try {
            if (contentType.includes("application/json")) {
              rawBody = await request.json();
            } else if (
              contentType.includes("application/x-www-form-urlencoded") ||
              contentType.includes("multipart/form-data")
            ) {
              const formData = await request.formData();
              const obj: Record<string, string> = {};
              formData.forEach((value, key) => {
                obj[key] = typeof value === "string" ? value : (value as File).name;
              });
              rawBody = obj;
            } else {
              // Tenta JSON como fallback
              const text = await request.text();
              try {
                rawBody = JSON.parse(text);
              } catch {
                // Tenta form-urlencoded como segundo fallback
                try {
                  const params = new URLSearchParams(text);
                  const obj: Record<string, string> = {};
                  params.forEach((value, key) => { obj[key] = value; });
                  rawBody = obj;
                } catch {
                  return new Response(JSON.stringify({ error: "Payload inválido: formato não suportado" }), {
                    status: 400,
                    headers,
                  });
                }
              }
            }
          } catch {
            return new Response(JSON.stringify({ error: "Erro ao ler o corpo da requisição" }), {
              status: 400,
              headers,
            });
          }

          let body: Record<string, any> = {};
          if (Array.isArray(rawBody) && rawBody.length > 0) {
            const first = rawBody[0];
            if (first && typeof first === "object" && "body" in first && typeof first.body === "object") {
              body = first.body as Record<string, any>;
            } else if (first && typeof first === "object") {
              body = first as Record<string, any>;
            }
          } else if (rawBody && typeof rawBody === "object") {
            body = rawBody as Record<string, any>;
          }

          // Normalizar todas as chaves do body para lowercase
          // Webflow, Wix e outros enviam campos capitalizados ("Nome", "WhatsApp", "Empresa")
          body = Object.fromEntries(
            Object.entries(body).map(([k, v]) => [k.toLowerCase().trim(), v]),
          );

          // 3. Checar chave de Idempotência
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

          // 4. Carregar regras de Mapeamento do Banco (webhook_field_mappings)
          let mappings: any[] = [];
          const dbMod = await import("@/lib/db");
          try {
            const [rows]: any = await dbMod.default.query(
              "SELECT * FROM webhook_field_mappings WHERE webhook_id = ?",
              [webhook.id],
            );
            if (rows?.length > 0) mappings = rows;
          } catch {}

          // 5. Aplicar mapeamentos de campos
          const mappedStandardFields: Record<string, unknown> = {};
          const mappedCustomFields: Record<string, unknown> = {};
          const unmappedFields: string[] = [];

          const allPayloadKeys = new Set<string>();
          Object.keys(body).forEach((k) => allPayloadKeys.add(k));

          for (const mapping of mappings) {
            const extField = mapping.external_field;
            allPayloadKeys.delete(extField);

            const rawValue = resolveDotPath(body, extField);
            if (rawValue === undefined) continue;

            const transformedValue = mapping.transformation ? applyTransform(rawValue, mapping.transformation) : rawValue;
            const targetKey = mapping.target_key || mapping.target_field;

            if (mapping.target_type === "standard" && targetKey) {
              mappedStandardFields[targetKey] = transformedValue;
            } else if (mapping.target_type === "custom") {
              const cfId = mapping.custom_field_id || targetKey;
              if (cfId) mappedCustomFields[cfId] = transformedValue;
            }
          }

          allPayloadKeys.forEach((k) => unmappedFields.push(k));

          // 6. Extrair campos com fallback automático (nome, email, telefone)
          // Usa || undefined para ignorar strings vazias (campos não preenchidos)
          const name: string | undefined =
            (mappedStandardFields.name as string) ||
            body.nome ||
            body.name ||
            body.full_name ||
            body.nome_completo ||
            undefined;

          const email: string | undefined =
            (mappedStandardFields.email as string) ||
            body.email ||
            body.mail ||
            body.email_contato ||
            undefined;

          const phone: string | undefined =
            (mappedStandardFields.phone as string) ||
            body.telefone ||
            body.phone ||
            body.whatsapp ||
            body.celular ||
            undefined;

          const company: string | undefined =
            (mappedStandardFields.company as string) ||
            body.empresa ||
            body.company ||
            undefined;

          const position: string | undefined =
            (mappedStandardFields.position as string) ||
            body.cargo ||
            body.position ||
            undefined;

          const external_id: string | undefined =
            (mappedStandardFields.external_id as string) ||
            body.external_id ||
            undefined;

          // O payload bruto também precisa acompanhar o contato. Sem isso,
          // campos capturados pelo snippet mas ainda não mapeados apareciam no
          // log do webhook e eram descartados ao criar/atualizar o lead.
          const capturedCustomFields: Record<string, unknown> = {
            ...(body.custom_fields && typeof body.custom_fields === "object" && !Array.isArray(body.custom_fields)
              ? body.custom_fields
              : {}),
          };
          for (const [key, value] of Object.entries(body)) {
            if (key !== "custom_fields" && key !== "idempotency_key") {
              capturedCustomFields[key] = value;
            }
          }

          if (!phone && !email && !external_id && !name) {
            const errMsg = "É necessário fornecer pelo menos 'nome', 'email', 'telefone' ou 'external_id'";
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

          // 7. Criar ou atualizar Contato/Lead no MySQL
          const contact = await upsertContactFromWebhook(
            webhook.tenant_id,
            {
              name,
              email: email ?? undefined,
              phone: phone ?? undefined,
              company,
              position,
              external_id: external_id ?? undefined,
              custom_fields: capturedCustomFields,
            },
            { id: webhook.id, name: webhook.name },
          );

          // Salvar valores dos campos personalizados se houver
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

          // Logar evento com sucesso
          await logIncomingWebhookEvent(webhook.id, body, "success", undefined, {
            contactId: contact.id,
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

          // Disparar Automação / Bot Flow se houver gatilho de webhook
          try {
            const { triggerWebhookBotFlow } = await import("@/lib/botflow-executor.server");
            triggerWebhookBotFlow(webhook.tenant_id, contact.id, body).catch((err) => {
              console.error("[Webhook Trigger] Erro ao disparar Bot Flow:", err);
            });
          } catch (err) {
            console.error("[Webhook Trigger] Erro importando botflow-executor:", err);
          }

          return new Response(
            JSON.stringify({
              ok: true,
              message: "Webhook recebido e processado com sucesso",
              contact_id: contact.id,
              created: contact.created,
              mapped_data: {
                nome: name,
                email,
                telefone: phone,
                empresa: company,
                cidade: body.cidade,
              },
            }),
            { status: 200, headers },
          );
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
