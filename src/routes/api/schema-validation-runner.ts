import { createFileRoute } from "@tanstack/react-router";
import { execSync } from "child_process";
import db from "@/lib/db";

export const Route = createFileRoute("/api/schema-validation-runner")({
  server: {
    handlers: {
      GET: async () => {
        const results: Record<string, any> = {};

        // 0. Ensure schema_migrations table exists and populates prior migrations
        await db.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        const migrations = [
          "001_canonical_schema.sql",
          "002_fix_indexes_and_constraints.sql",
          "003_runtime_schema_alignment.sql",
          "004_calendar_events.sql",
          "005_legacy_contact_custom_fields_fix.sql",
          "006_subscription_trial_access.sql",
          "007_restore_active_runtime_tables.sql",
          "008_align_schema_with_local_database.sql",
          "008_restore_legacy_compatibility_tables.sql",
          "009_align_licenses_full_schema.sql",
          "010_align_subscription_plans_with_local_schema.sql",
          "011_align_payment_gateway_settings_with_local_schema.sql",
        ];

        for (const m of migrations) {
          await db.query("INSERT IGNORE INTO schema_migrations (version) VALUES (?)", [m]);
        }

        const [rows] = (await db.query("SELECT version FROM schema_migrations")) as any[];
        results.appliedMigrationsBeforeRun = rows.map((r: any) => r.version);

        // 1. Run migrate.js (which should execute 012_reconcile_full_schema_with_local.sql)
        try {
          results.migrateOutput = execSync("node scripts/migrate.js", {
            cwd: process.cwd(),
            encoding: "utf8",
            env: { ...process.env, DB_HOST: "localhost", DB_PASSWORD: "S0xbxPfKazBVT8JFy1UEOjIsrjox" },
          });
        } catch (err: any) {
          results.migrateError = err.stdout || err.stderr || err.message;
        }

        // 2. Run validate-database.js
        try {
          results.validateDatabaseOutput = execSync("node scripts/validate-database.js", {
            cwd: process.cwd(),
            encoding: "utf8",
            env: { ...process.env, DB_HOST: "localhost", DB_PASSWORD: "S0xbxPfKazBVT8JFy1UEOjIsrjox" },
          });
        } catch (err: any) {
          results.validateDatabaseError = err.stdout || err.stderr || err.message;
        }

        // 3. Run validate-schema-parity.js
        try {
          results.validateParityOutput = execSync("node scripts/validate-schema-parity.js", {
            cwd: process.cwd(),
            encoding: "utf8",
            env: { ...process.env, DB_HOST: "localhost", DB_PASSWORD: "S0xbxPfKazBVT8JFy1UEOjIsrjox" },
          });
        } catch (err: any) {
          results.validateParityError = err.stdout || err.stderr || err.message;
        }

        // 4. Run audit-runtime-schema.js
        try {
          results.auditRuntimeOutput = execSync("node scripts/audit-runtime-schema.js", {
            cwd: process.cwd(),
            encoding: "utf8",
            env: { ...process.env, DB_HOST: "localhost", DB_PASSWORD: "S0xbxPfKazBVT8JFy1UEOjIsrjox" },
          });
        } catch (err: any) {
          results.auditRuntimeError = err.stdout || err.stderr || err.message;
        }

        // 5. Run test-payment-gateway-settings.js
        try {
          results.testPaymentGatewayOutput = execSync("node scripts/test-payment-gateway-settings.js", {
            cwd: process.cwd(),
            encoding: "utf8",
            env: { ...process.env, DB_HOST: "localhost", DB_PASSWORD: "S0xbxPfKazBVT8JFy1UEOjIsrjox" },
          });
        } catch (err: any) {
          results.testPaymentGatewayError = err.stdout || err.stderr || err.message;
        }

        return new Response(JSON.stringify(results, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
