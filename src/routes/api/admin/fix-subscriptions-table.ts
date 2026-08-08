import { createFileRoute } from "@tanstack/react-router";
import mysql from "mysql2/promise";
import { enforceAdminMaster } from "@/lib/admin-master-auth";

export const Route = createFileRoute("/api/admin/fix-subscriptions-table")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authError = await enforceAdminMaster(request);
        if (authError) return authError;

        const log: string[] = [];
        let connection: mysql.Connection | null = null;
        try {
          connection = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            port: parseInt(process.env.DB_PORT || "3306", 10),
            user: process.env.DB_USER || "wapi_user",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "wapi_weaver",
          });

          // Add payment_provider
          try {
            await connection.query("ALTER TABLE subscriptions ADD COLUMN payment_provider VARCHAR(32) DEFAULT 'mercado_pago'");
            log.push("payment_provider added");
          } catch (e: any) {
            log.push(`payment_provider err: ${e.message}`);
          }

          // Add grace_period_ends_at
          try {
            await connection.query("ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at DATETIME NULL");
            log.push("grace_period_ends_at added");
          } catch (e: any) {
            log.push(`grace_period_ends_at err: ${e.message}`);
          }

          const [cols] = await connection.query("SHOW COLUMNS FROM subscriptions") as any[];
          const fields = cols.map((c: any) => c.Field);

          return new Response(JSON.stringify({ success: true, fields, log }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ success: false, error: e.message, log }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } finally {
          if (connection) {
            await connection.end();
          }
        }
      },
    },
  },
});
