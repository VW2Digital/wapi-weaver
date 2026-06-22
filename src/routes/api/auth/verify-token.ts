import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

export const Route = createFileRoute("/api/auth/verify-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { token } = await request.json();

          if (!token) {
            return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          let decoded: any;
          try {
            decoded = jwt.verify(token, JWT_SECRET);
          } catch (e: any) {
            return new Response(JSON.stringify({ error: "Link inválido ou expirado." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!decoded || !decoded.sub || !decoded.purpose) {
            return new Response(JSON.stringify({ error: "Token inválido." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Validate purpose
          if (decoded.purpose !== "magic-link" && decoded.purpose !== "password-reset") {
            return new Response(JSON.stringify({ error: "Propósito de token inválido." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch user
          const users = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [decoded.sub]);
          if (!users || users.length === 0) {
            return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const user = users[0];

          // Fetch user role
          const roles = await db.query("SELECT role FROM user_roles WHERE user_id = ? LIMIT 1", [
            user.id,
          ]);
          const role = roles && roles.length > 0 ? roles[0].role : "user";

          // Sign new long-lived session JWT (30 days)
          const sessionToken = jwt.sign(
            { sub: user.id, email: user.email, role },
            JWT_SECRET,
            { expiresIn: "30d" }
          );

          const responseData = {
            access_token: sessionToken,
            user: {
              id: user.id,
              email: user.email,
              role,
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: user.created_at,
            },
          };

          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Auth API] Token verification error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
