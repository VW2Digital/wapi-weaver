import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";

import { JWT_SECRET } from "@/lib/jwt-secret";

export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json();

          if (!email) {
            return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch user
          const users = await db.query("SELECT id, email FROM users WHERE email = ? LIMIT 1", [
            email,
          ]);
          if (users && users.length > 0) {
            const user = users[0];

            // Generate short-lived JWT for password recovery
            const token = jwt.sign(
              { sub: user.id, email: user.email, purpose: "password-reset" },
              JWT_SECRET,
              { expiresIn: "15m" },
            );

            // Get origin from request URL
            const origin = new URL(request.url).origin;
            const resetLink = `${origin}/reset-password?token=${token}`;

            // In development, print the link for convenience. In production, only log the event.
            if (process.env.NODE_ENV !== "production") {
              console.log(`\n======================================================`);
              console.log(`[AUTH] LINK DE RECUPERAÇÃO DE SENHA SOLICITADO`);
              console.log(`E-mail: ${user.email}`);
              console.log(`Link:   ${resetLink}`);
              console.log(`======================================================\n`);
            } else {
              console.log(`[AUTH] Password reset requested for ${user.email}`);
            }
          } else {
            // Standard security practice: do not reveal whether the email exists
            if (process.env.NODE_ENV !== "production") {
              console.log(`\n[AUTH] Recuperação de senha solicitada para e-mail não cadastrado: ${email}\n`);
            }
          }

          // Return success even if email wasn't found (standard security practice)
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
