import { createFileRoute } from "@tanstack/react-router";
import { requirePaymentGatewayAdmin } from "@/lib/payment-gateway-admin";
import {
  getGlobalEmailProviderRow,
  publicEmailProviderView,
  upsertGlobalEmailProvider,
} from "@/lib/email-provider";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/admin/email-provider")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requirePaymentGatewayAdmin(request);
          const reveal = new URL(request.url).searchParams.get("reveal") === "true";
          const row = await getGlobalEmailProviderRow();
          return json(publicEmailProviderView(row, reveal));
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
          await upsertGlobalEmailProvider({
            from_email: String(body.from_email ?? "").trim(),
            from_name: String(body.from_name ?? "").trim(),
            reply_to: String(body.reply_to ?? "").trim(),
            is_active: body.is_active !== false,
            api_key: body.api_key,
          });
          const row = await getGlobalEmailProviderRow();
          return json({ ...publicEmailProviderView(row, false), success: true });
        } catch (error: any) {
          const forbidden = error.message?.startsWith("Forbidden");
          const unauthorized = error.message?.startsWith("Unauthorized");
          return json({ error: error.message }, forbidden ? 403 : unauthorized ? 401 : 500);
        }
      },
    },
  },
});
