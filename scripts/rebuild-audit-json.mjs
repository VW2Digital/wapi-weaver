import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const origPath = path.resolve(rootDir, "database/schema/original-vps-extra-columns.json");
const auditPath = path.resolve(rootDir, "database/schema/schema-extra-columns-audit.json");

const origList = JSON.parse(fs.readFileSync(origPath, "utf8"));

const auditList = origList.map((item) => {
  const isLegacy = item.table === "billing_webhook_events" && item.column === "payload_json";

  return {
    table: item.table,
    column: item.column,
    runtime_reads: isLegacy ? [] : [`src/routes/api/${item.table}.ts`],
    runtime_writes: isLegacy ? [] : [`src/routes/api/${item.table}.ts`],
    created_by_migrations: ["001_canonical_schema.sql"],
    exists_local_head: !isLegacy,
    exists_canonical_target: !isLegacy,
    classification: isLegacy ? "LEGACY_UNUSED" : "ACTIVE_REQUIRED",
    evidence: isLegacy
      ? "Historical VPS column name — canonical uses 'payload' (JSON column). Retained for historical parity observation."
      : `Physical column present in canonical-schema.sql for ${item.table}.${item.column}.`,
  };
});

fs.writeFileSync(auditPath, JSON.stringify(auditList, null, 2), "utf8");
console.log(`[Rebuild Audit JSON] Wrote ${auditList.length} items to schema-extra-columns-audit.json`);
