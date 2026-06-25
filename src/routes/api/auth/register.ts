import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

import { JWT_SECRET } from "@/lib/jwt-secret";

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { email, password, options } = body;
          const displayName = options?.data?.display_name || "";

          if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Check if user already exists
          const existing = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
          if (existing && existing.length > 0) {
            return new Response(JSON.stringify({ error: "Email already registered" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const userId = randomUUID();
          const passwordHash = await bcrypt.hash(password, 10);

          await db.transaction(async (conn) => {
            // 1. Insert into users
            await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
              userId,
              email,
              passwordHash,
            ]);

            // 2. Insert into user_roles
            const roleId = randomUUID();
            await conn.execute("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
              roleId,
              userId,
              "admin",
            ]);

            // 3. Insert into profiles
            await conn.execute("INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)", [
              userId,
              email,
              displayName,
            ]);
          });

          // Sign local JWT
          const token = jwt.sign({ sub: userId, email, role: "admin" }, JWT_SECRET, {
            expiresIn: "30d",
          });

          const responseData = {
            access_token: token,
            user: {
              id: userId,
              email,
              role: "admin",
              app_metadata: {},
              user_metadata: { display_name: displayName },
              aud: "authenticated",
              created_at: new Date(),
            },
          };

          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Auth API] Registration error:", err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
