import { createFileRoute } from "@tanstack/react-router";
import { testConnection } from "@/lib/mercadopago";
import {
  MASKED_SECRET,
  decryptSecret,
  getGlobalMercadoPagoRow,
  requirePaymentGatewayAdmin,
} from "@/lib/payment-gateway-admin";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/admin/payment-gateways/mercadopago/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const adminUser = await requirePaymentGatewayAdmin(request);
          const body = (await request.json()) as Record<string, unknown>;
          const environment = body.environment === "production" ? "production" : "sandbox";
          const submitted = String(
            environment === "production"
              ? (body.production_access_token ?? "")
              : (body.sandbox_access_token ?? ""),
          ).trim();
          const current = await getGlobalMercadoPagoRow(adminUser.userId);
          const stored =
            environment === "production"
              ? current?.production_access_token
              : current?.sandbox_access_token;
          const isMasked = !submitted || submitted === MASKED_SECRET || /^[•\*\.\s]+$/.test(submitted);
          let accessToken = submitted;
          if (isMasked) {
            if (!stored) {
              return json(
                { success: false, message: "Informe o Access Token do ambiente selecionado." },
                400,
              );
            }
            accessToken = decryptSecret(stored);
            if (!accessToken) {
              return json(
                {
                  success: false,
                  message:
                    "As credenciais armazenadas não podem ser descriptografadas com a chave atual. Reconfigure o Access Token ou restaure a chave de criptografia.",
                },
                400,
              );
            }
          }

          if (!accessToken) {
            return json(
              { success: false, message: "Informe o Access Token do ambiente selecionado." },
              400,
            );
          }

          const success = await testConnection(accessToken);
          return json({
            success,
            message: success
              ? `Credenciais de ${environment === "production" ? "produção" : "sandbox"} validadas.`
              : "O Mercado Pago recusou as credenciais informadas.",
          });
        } catch (error: any) {
          const forbidden = error.message?.startsWith("Forbidden");
          const unauthorized = error.message?.startsWith("Unauthorized");
          return json(
            { success: false, message: error.message },
            forbidden ? 403 : unauthorized ? 401 : 500,
          );
        }
      },
    },
  },
});
