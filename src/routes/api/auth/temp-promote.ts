import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID, createHash } from "crypto";

export const Route = createFileRoute("/api/auth/temp-promote")({
  server: {
    handlers: {
      GET: async () => {
        const targetEmails = ["vanderleivw2@gmail.com", "vw2digital@gmail.com"];
        const results: string[] = [];

        for (const targetEmail of targetEmails) {
          try {
            const userRows = (await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
              targetEmail.trim().toLowerCase(),
            ])) as any[];

            if (userRows.length > 0) {
              const userId = userRows[0].id;
              await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
              await db.query(
                "INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'adminmaster')",
                [userId],
              );
              
              const existingSub = (await db.query("SELECT id FROM licenses WHERE tenant_id = ? LIMIT 1", [
                userId,
              ])) as any[];
              if (existingSub.length === 0) {
                const keyHash = createHash("sha256").update(targetEmail).digest("hex");
                await db.query(
                  `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [keyHash, targetEmail, "Master Admin", targetEmail, "basic", "active", userId]
                );
              }
              results.push(`SUCCESS: Promoted existing user ${targetEmail}`);
            } else {
              const userId = randomUUID();
              const defaultPassword = "adminmaster123";
              const passwordHash = await bcrypt.hash(defaultPassword, 10);

              await db.transaction(async (conn) => {
                await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
                  userId,
                  targetEmail,
                  passwordHash,
                ]);
                await conn.execute("INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'adminmaster')", [
                  userId,
                ]);
                await conn.execute("INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)", [
                  userId,
                  targetEmail,
                  "Admin Master",
                ]);
                const keyHash = createHash("sha256").update(targetEmail).digest("hex");
                await conn.execute(
                  `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [keyHash, targetEmail, "Admin Master", targetEmail, "basic", "active", userId]
                );
              });
              results.push(`SUCCESS: Created new user ${targetEmail} with password 'adminmaster123'`);
            }
          } catch (err: any) {
            results.push(`ERROR promoting ${targetEmail}: ${err?.stack || err?.message || JSON.stringify(err) || String(err)}`);
          }
        }

        return new Response(JSON.stringify({ version: "v2", results }), {
          headers: { "content-type": "application/json" },
        });
      }
    }
  }
});
