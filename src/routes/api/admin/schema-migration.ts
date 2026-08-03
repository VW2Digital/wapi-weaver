import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";

export const Route = createFileRoute("/api/admin/schema-migration")({
  server: {
    handlers: {
      GET: async () => {
        const results: string[] = [];

        const tryQuery = async (label: string, sql: string) => {
          try {
            await db.query(sql);
            results.push(`[OK] ${label}`);
          } catch (e: any) {
            results.push(`[NOTE] ${label}: ${e.message}`);
          }
        };

        await tryQuery("payment_provider", "ALTER TABLE subscriptions ADD COLUMN payment_provider VARCHAR(32) DEFAULT 'mercado_pago'");
        await tryQuery("grace_period_ends_at", "ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at DATETIME NULL");

        await tryQuery(
          "subscription_events",
          `CREATE TABLE IF NOT EXISTS subscription_events (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            subscription_id VARCHAR(36) NOT NULL,
            event_type VARCHAR(64) NOT NULL,
            previous_status VARCHAR(32) NULL,
            new_status VARCHAR(32) NULL,
            source VARCHAR(64) NOT NULL,
            gateway_event_id VARCHAR(255) NULL,
            raw_payload LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sub_events_tenant (tenant_id),
            INDEX idx_sub_events_sub (subscription_id),
            UNIQUE KEY idx_sub_events_source_gateway (source, gateway_event_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );

        await tryQuery(
          "subscription_plan_changes",
          `CREATE TABLE IF NOT EXISTS subscription_plan_changes (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            subscription_id VARCHAR(36) NOT NULL,
            old_plan VARCHAR(64) NOT NULL,
            new_plan VARCHAR(64) NOT NULL,
            effective_date DATETIME NOT NULL,
            applied_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_plan_changes_tenant (tenant_id),
            INDEX idx_plan_changes_sub (subscription_id),
            INDEX idx_plan_changes_effective (effective_date, applied_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );

        return new Response(JSON.stringify({ success: true, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
