import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import {
  MASKED_SECRET,
  encryptedValue,
  gatewayId,
  getGlobalMercadoPagoRow,
  requirePaymentGatewayAdmin,
} from "@/lib/payment-gateway-admin";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const secretField = (value: unknown) => (value ? MASKED_SECRET : "");

export const Route = createFileRoute("/api/admin/payment-gateways/mercadopago")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requirePaymentGatewayAdmin(request);
          const row = await getGlobalMercadoPagoRow();
          const origin = new URL(request.url).origin;

          return json({
            environment: row?.environment ?? "sandbox",
            checkout_mode: row?.checkout_mode ?? "redirect",
            sandbox_public_key: row?.sandbox_public_key ?? "",
            sandbox_client_id: row?.sandbox_client_id ?? "",
            sandbox_access_token: secretField(row?.sandbox_access_token),
            sandbox_client_secret: secretField(row?.sandbox_client_secret),
            production_public_key: row?.production_public_key ?? "",
            production_client_id: row?.production_client_id ?? "",
            production_access_token: secretField(row?.production_access_token),
            production_client_secret: secretField(row?.production_client_secret),
            webhook_secret: secretField(row?.webhook_secret),
            webhook_url: `${origin}/api/webhooks/mercadopago`,
          });
        } catch (error: any) {
          const forbidden = error.message?.startsWith("Forbidden");
          const unauthorized = error.message?.startsWith("Unauthorized");
          return json({ error: error.message }, forbidden ? 403 : unauthorized ? 401 : 500);
        }
      },
      PUT: async ({ request }) => {
        try {
          await requirePaymentGatewayAdmin(request);
          const body = (await request.json()) as Record<string, unknown>;
          const environment = body.environment === "production" ? "production" : "sandbox";
          const checkoutMode = body.checkout_mode === "transparent" ? "transparent" : "redirect";
          const current = await getGlobalMercadoPagoRow();

          const values = {
            sandboxPublicKey: String(body.sandbox_public_key ?? "").trim(),
            sandboxClientId: String(body.sandbox_client_id ?? "").trim(),
            sandboxAccessToken: encryptedValue(
              body.sandbox_access_token,
              current?.sandbox_access_token,
            ),
            sandboxClientSecret: encryptedValue(
              body.sandbox_client_secret,
              current?.sandbox_client_secret,
            ),
            productionPublicKey: String(body.production_public_key ?? "").trim(),
            productionClientId: String(body.production_client_id ?? "").trim(),
            productionAccessToken: encryptedValue(
              body.production_access_token,
              current?.production_access_token,
            ),
            productionClientSecret: encryptedValue(
              body.production_client_secret,
              current?.production_client_secret,
            ),
            webhookSecret: encryptedValue(body.webhook_secret, current?.webhook_secret),
          };

          await db.query(
            `INSERT INTO payment_gateway_settings (
              id, tenant_id, provider, environment, checkout_mode,
              sandbox_public_key, sandbox_client_id, sandbox_access_token, sandbox_client_secret,
              production_public_key, production_client_id, production_access_token,
              production_client_secret, webhook_secret
            ) VALUES (?, 'global', 'mercadopago', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              environment = VALUES(environment), checkout_mode = VALUES(checkout_mode),
              sandbox_public_key = VALUES(sandbox_public_key),
              sandbox_client_id = VALUES(sandbox_client_id),
              sandbox_access_token = VALUES(sandbox_access_token),
              sandbox_client_secret = VALUES(sandbox_client_secret),
              production_public_key = VALUES(production_public_key),
              production_client_id = VALUES(production_client_id),
              production_access_token = VALUES(production_access_token),
              production_client_secret = VALUES(production_client_secret),
              webhook_secret = VALUES(webhook_secret)`,
            [
              current?.id ?? gatewayId(),
              environment,
              checkoutMode,
              values.sandboxPublicKey,
              values.sandboxClientId,
              values.sandboxAccessToken,
              values.sandboxClientSecret,
              values.productionPublicKey,
              values.productionClientId,
              values.productionAccessToken,
              values.productionClientSecret,
              values.webhookSecret,
            ],
          );

          return json({ success: true });
        } catch (error: any) {
          const forbidden = error.message?.startsWith("Forbidden");
          const unauthorized = error.message?.startsWith("Unauthorized");
          return json({ error: error.message }, forbidden ? 403 : unauthorized ? 401 : 500);
        }
      },
    },
  },
});
