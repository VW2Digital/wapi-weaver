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
            config = await getMercadoPagoConfig("__any__").catch(() => null);
          }

          return new Response(
            JSON.stringify({
              publicKey: config?.publicKey || "",
              checkoutMode: config?.checkoutMode || "redirect",
              environment: config?.environment || "sandbox",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          return new Response(JSON.stringify({ publicKey: "", checkoutMode: "redirect", environment: "sandbox" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
