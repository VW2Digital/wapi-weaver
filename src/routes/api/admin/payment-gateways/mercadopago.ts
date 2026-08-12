import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import {
  MASKED_SECRET,
  decryptSecret,
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
          const adminUser = await requirePaymentGatewayAdmin(request);
          const row = await getGlobalMercadoPagoRow(adminUser.userId);
          const requestUrl = new URL(request.url);
          const revealParam = requestUrl.searchParams.get("reveal");
          const revealAll = revealParam === "true";
          const origin = requestUrl.origin;

          const secretVal = (val?: string | null, fieldName?: string) => {
            if (!val) return "";
            if (revealAll || (revealParam && fieldName && revealParam === fieldName)) {
              return decryptSecret(val);
            }
            return MASKED_SECRET;
          };

          return json({
            environment: row?.environment ?? "sandbox",
            checkout_mode: row?.checkout_mode ?? "redirect",
            provider: row?.provider ?? "mercadopago",
            sandbox_public_key: row?.sandbox_public_key ?? "",
            sandbox_client_id: row?.sandbox_client_id ?? "",
            sandbox_access_token: secretVal(row?.sandbox_access_token, "sandbox_access_token"),
            sandbox_client_secret: secretVal(row?.sandbox_client_secret, "sandbox_client_secret"),
            production_public_key: row?.production_public_key ?? "",
            production_client_id: row?.production_client_id ?? "",
            production_access_token: secretVal(row?.production_access_token, "production_access_token"),
            production_client_secret: secretVal(row?.production_client_secret, "production_client_secret"),
            webhook_secret: secretVal(row?.webhook_secret, "webhook_secret"),
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
          const adminUser = await requirePaymentGatewayAdmin(request);
          const body = (await request.json()) as Record<string, unknown>;
          const environment = body.environment === "production" ? "production" : "sandbox";
          const checkoutMode = body.checkout_mode === "transparent" ? "transparent" : "redirect";
          // Platform billing config MUST always be identified by 'global', not by admin user ID
          const targetTenantId = "global";
          const globalRows = (await db.query(
            "SELECT * FROM payment_gateway_settings WHERE tenant_id = 'global' LIMIT 1"
          )) as any[];
          const current = globalRows.length > 0 ? globalRows[0] : null;


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

          if (current) {
            await db.query(
              `UPDATE payment_gateway_settings SET
                provider = 'mercadopago',
                environment = ?,
                checkout_mode = ?,
                sandbox_public_key = ?,
                sandbox_client_id = ?,
                sandbox_access_token = ?,
                sandbox_client_secret = ?,
                production_public_key = ?,
                production_client_id = ?,
                production_access_token = ?,
                production_client_secret = ?,
                webhook_secret = ?
               WHERE tenant_id = ?`,
              [
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
                targetTenantId,
              ],
            );
          } else {
            await db.query(
              `INSERT INTO payment_gateway_settings (
                id, tenant_id, provider, environment, checkout_mode,
                sandbox_public_key, sandbox_client_id, sandbox_access_token, sandbox_client_secret,
                production_public_key, production_client_id, production_access_token,
                production_client_secret, webhook_secret
              ) VALUES (?, ?, 'mercadopago', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                gatewayId(),
                targetTenantId,
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
          }

          return json({ success: true });
        } catch (error: any) {
          console.error("[MercadoPago PUT Error]", error);
          const errMsg =
            error?.message ||
            (typeof error === "string" ? error : null) ||
            "Erro interno do servidor ao salvar configurações.";
          const forbidden = errMsg.startsWith("Forbidden");
          const unauthorized = errMsg.startsWith("Unauthorized");
          return json({ error: errMsg }, forbidden ? 403 : unauthorized ? 401 : 500);
        }
      },
    },
  },
});
