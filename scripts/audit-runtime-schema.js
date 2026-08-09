/**
 * Audit Runtime Schema Script (ESM)
 * Verifies that key runtime SQL queries and table/column references in application source code
 * map directly to valid entries in database/schema/required-columns.json and database/schema/required-tables.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const tablesPath = path.resolve(__dirname, "../database/schema/required-tables.json");
  const columnsPath = path.resolve(__dirname, "../database/schema/required-columns.json");

  const requiredTables = new Set(JSON.parse(fs.readFileSync(tablesPath, "utf8")));
  const requiredColumns = JSON.parse(fs.readFileSync(columnsPath, "utf8"));

  // Key runtime queries and column usages in license-admin.functions.ts and license-server.ts
  const runtimeReferences = [
    {
      table: "licenses",
      columns: [
        "id",
        "license_key_hash",
        "license_key_preview",
        "client_name",
        "client_email",
        "product_name",
        "app_id",
        "plan",
        "status",
        "expires_at",
        "max_activations",
        "max_users",
        "features_json",
        "notes",
        "tenant_id",
      ],
    },
    {
      table: "license_activations",
      columns: [
        "id",
        "license_id",
        "domain",
        "app_url",
        "installation_id",
        "ip_address",
        "user_agent",
        "status",
        "activated_at",
      ],
    },
    {
      table: "license_validation_logs",
      columns: [
        "id",
        "license_id",
        "domain",
        "app_url",
        "installation_id",
        "ip_address",
        "app_id",
        "result",
        "reason",
        "payload_json",
        "created_at",
      ],
    },
    {
      table: "schema_backups",
      columns: ["id", "created_by", "source", "sql", "size_bytes", "created_at"],
    },
    {
      table: "notifications",
      columns: ["id", "tenant_id", "user_id", "type", "title", "message", "action_url", "is_read", "unique_key", "created_at", "read_at"],
    },
  ];

  let missingTables = 0;
  let missingColumns = 0;

  for (const ref of runtimeReferences) {
    if (!requiredTables.has(ref.table)) {
      console.error(`[Runtime Schema Audit] ❌ FAIL: Runtime table '${ref.table}' missing in required-tables.json!`);
      missingTables++;
      continue;
    }

    const tableCols = new Set(requiredColumns[ref.table] || []);
    for (const col of ref.columns) {
      if (!tableCols.has(col)) {
        console.error(`[Runtime Schema Audit] ❌ FAIL: Runtime column '${col}' in table '${ref.table}' missing in required-columns.json!`);
        missingColumns++;
      }
    }
  }

  if (missingTables > 0 || missingColumns > 0) {
    console.error(`[Runtime Schema Audit] ❌ FAIL: Found ${missingTables} missing table(s) and ${missingColumns} missing column(s) in runtime contract.`);
    process.exit(1);
  }

  console.log(`[Runtime Schema Audit] ✅ SUCCESS: Verified runtime SQL references against schema contracts (0 missing table/column references).`);
}

main();
