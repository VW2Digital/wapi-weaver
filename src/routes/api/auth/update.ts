import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

export const Route = createFileRoute("/api/auth/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const token = authHeader.replace("Bearer ", "");
          let decoded: any;
          try {
            decoded = jwt.verify(token, JWT_SECRET);
          } catch (e) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const userId = decoded.sub;
          const { password } = await request.json();

          if (!password) {
            return new Response(JSON.stringify({ error: "Password is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const passwordHash = await bcrypt.hash(password, 10);
          await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Auth API] Password update error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
