import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

export const Route = createFileRoute("/api/auth/otp")({
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
          const users = await db.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
          if (!users || users.length === 0) {
            return new Response(
              JSON.stringify({ error: "Nenhum usuário encontrado com este e-mail." }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const user = users[0];

          // Generate short-lived JWT for magic link
          const token = jwt.sign(
            { sub: user.id, email: user.email, purpose: "magic-link" },
            JWT_SECRET,
            { expiresIn: "15m" },
          );

          // Get origin from request URL
          const origin = new URL(request.url).origin;
          const magicLink = `${origin}/login?token=${token}`;

          // Print link directly to server terminal
          console.log(`\n======================================================`);
          console.log(`[AUTH] LINK MÁGICO DE ACESSO SOLICITADO`);
          console.log(`E-mail: ${user.email}`);
          console.log(`Link:   ${magicLink}`);
          console.log(`======================================================\n`);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Auth API] OTP error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
