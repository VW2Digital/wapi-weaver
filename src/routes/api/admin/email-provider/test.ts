import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { MASKED_SECRET, requirePaymentGatewayAdmin } from "@/lib/payment-gateway-admin";
import { decryptApiKey, getGlobalEmailProviderRow, sendResendEmail } from "@/lib/email-provider";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/admin/email-provider/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const admin = await requirePaymentGatewayAdmin(request);
          const body = (await request.json()) as Record<string, unknown>;
          const submittedKey = String(body.api_key ?? "").trim();
          const fromEmail = String(body.from_email ?? "").trim();
          const fromName = String(body.from_name ?? "").trim();
          const replyTo = String(body.reply_to ?? "").trim();
          let to = String(body.to ?? "").trim();

          if (!to) {
            const users = (await db.query("SELECT email FROM users WHERE id = ? LIMIT 1", [
              admin.userId,
            ])) as Array<{ email: string }>;
            to = users[0]?.email ?? "";
          }

          if (!to) {
            return json({ success: false, message: "Informe um e-mail de destino para o teste." }, 400);
          }

          const current = await getGlobalEmailProviderRow();
          const isMasked = !submittedKey || submittedKey === MASKED_SECRET || /^[•*.\s]+$/.test(submittedKey);
          const apiKey = isMasked ? decryptApiKey(current?.api_key_encrypted) : submittedKey;

          const result = await sendResendEmail({
            to,
            subject: "Teste de e-mail — Bliv",
            html: "<p>Este é um e-mail de teste da configuração Resend da plataforma.</p>",
            apiKey,
            fromEmail: fromEmail || current?.from_email || undefined,
            fromName: fromName || current?.from_name || undefined,
            replyTo: replyTo || current?.reply_to,
          });

          return json({ success: result.ok, message: result.message }, result.ok ? 200 : 400);
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
