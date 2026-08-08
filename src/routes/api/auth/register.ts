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

          const cleanEmail = String(email).trim().toLowerCase();
          if (!cleanEmail || !password) {
            return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Check if user already exists
          const existing = await db.query("SELECT id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1", [cleanEmail]);
          if (existing && existing.length > 0) {
            return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado no sistema." }), {
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
              cleanEmail,
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
              cleanEmail,
              displayName,
            ]);

            // 4. Insert default subscription (license) record for this owner
            const crypto = await import("crypto");
            const licenseKey = cleanEmail;
            const keyHash = crypto.createHash("sha256").update(licenseKey).digest("hex");
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 15); // 15 days trial

            await conn.execute(
              `INSERT INTO licenses (id, license_key_hash, license_key_preview, client_name, client_email, plan, status, expires_at, tenant_id)
               VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), client_email = VALUES(client_email), status = 'active'`,
              [keyHash, cleanEmail, displayName || cleanEmail, cleanEmail, "basic", "active", expiresAt, userId],
            );
          });

          // Sign local JWT
          const token = jwt.sign({ sub: userId, email: cleanEmail, role: "admin" }, JWT_SECRET, {
            expiresIn: "30d",
          });

          const responseData = {
            access_token: token,
            user: {
              id: userId,
              email: cleanEmail,
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
          let errorMessage = err?.message || "Erro no servidor ao realizar cadastro.";
          if (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062 || String(err?.message).includes("licenses")) {
            errorMessage = "Já existe uma licença ou conta cadastrada com este e-mail.";
          }
          return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
