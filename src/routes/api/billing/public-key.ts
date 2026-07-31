// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { getMercadoPagoConfig } from "@/lib/mercadopago";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/public-key")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifyApiUser(request);
          let config = await getMercadoPagoConfig(user.tenantId).catch(() => null);
          if (!config || !config.publicKey) {
            config = await getMercadoPagoConfig("global").catch(() => null);
          }

          return new Response(
            JSON.stringify({
              publicKey: config?.publicKey || "",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          return new Response(JSON.stringify({ publicKey: "" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
