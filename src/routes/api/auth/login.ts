import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

import { JWT_SECRET } from "@/lib/jwt-secret";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email, password } = await request.json();
          if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch user
          const users = await db.query(
            "SELECT id, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1",
            [email],
          );
          if (!users || users.length === 0) {
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const user = users[0];

          // Compare password
          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) {
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Fetch user role
          const roles = await db.query("SELECT role FROM user_roles WHERE user_id = ? LIMIT 1", [
            user.id,
          ]);
          const role = roles && roles.length > 0 ? roles[0].role : "user";

          // Sign local JWT containing sub (id), email and role
          const token = jwt.sign({ sub: user.id, email: user.email, role }, JWT_SECRET, {
            expiresIn: "30d",
          });

          const responseData = {
            access_token: token,
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
          console.error("[Auth API] Login error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
