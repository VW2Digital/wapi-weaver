import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { issuePasswordResetEmail } from "@/lib/email-provider";

export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json();

          if (!email || typeof email !== "string") {
            return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const users = await db.query("SELECT id, email FROM users WHERE email = ? LIMIT 1", [
            email.trim(),
          ]);

          if (users && users.length > 0) {
            const user = users[0];
            const origin = new URL(request.url).origin;
            const requestedIp =
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
              request.headers.get("x-real-ip") ??
              null;

            await issuePasswordResetEmail({
              userId: user.id,
              email: user.email,
              requestOrigin: origin,
              requestedIp,
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Auth API] Forgot Password error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
