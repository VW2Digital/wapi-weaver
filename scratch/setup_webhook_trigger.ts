import db from "../src/lib/db";

async function main() {
  console.log("Starting DB migration for webhook trigger...");

  try {
    console.log("Altering column trigger_value in bot_steps to TEXT...");
    await db.query("ALTER TABLE bot_steps MODIFY COLUMN trigger_value TEXT NULL");
    console.log("SUCCESS: Altered bot_steps table.");
  } catch (e: any) {
    console.error("Error altering bot_steps:", e.message);
  }

  try {
    console.log("Creating webhook_bot_logs table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS webhook_bot_logs (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        flow_id VARCHAR(36) NOT NULL,
        flow_name VARCHAR(255) NOT NULL,
        contact_id VARCHAR(36) NOT NULL,
        is_match BOOLEAN NOT NULL DEFAULT FALSE,
        raw_conditions JSON NOT NULL,
        raw_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wbl_tenant_contact (tenant_id, contact_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("SUCCESS: Created webhook_bot_logs table.");
  } catch (e: any) {
    console.error("Error creating webhook_bot_logs:", e.message);
  }

  console.log("Migration completed.");
  process.exit(0);
}

main().catch(console.error);
