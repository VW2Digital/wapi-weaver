// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { getMercadoPagoConfig } from "@/lib/mercadopago";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const Route = createFileRoute("/api/billing/public-key")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await verifyApiUser(request);
          const config = await getMercadoPagoConfig("global").catch(() => null);

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
