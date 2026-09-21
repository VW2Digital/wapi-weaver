import { createFileRoute } from "@tanstack/react-router";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { consumePasswordResetToken, markPasswordResetUsed } from "@/lib/email-provider";

export const Route = createFileRoute("/api/auth/reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { token, password } = await request.json();
          if (!token || typeof token !== "string") {
            return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!password || typeof password !== "string" || password.length < 8) {
            return new Response(JSON.stringify({ error: "A senha precisa ter ao menos 8 caracteres." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const consumed = await consumePasswordResetToken(token);
          if (!consumed.ok) {
            return new Response(JSON.stringify({ error: consumed.message }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const passwordHash = await bcrypt.hash(password, 10);
          await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [
            passwordHash,
            consumed.userId,
          ]);
          await markPasswordResetUsed(consumed.tokenId, consumed.tenantId, consumed.userId);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Auth API] Reset password error:", err);
          return new Response(JSON.stringify({ error: "Falha ao redefinir senha" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
