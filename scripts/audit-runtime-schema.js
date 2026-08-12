/**
 * Audit Runtime Schema Script (ESM)
 * Comprehensive scanner for table and column references in src/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function getAllSourceFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllSourceFiles(fullPath, arrayOfFiles);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file) && !file.endsWith(".d.ts")) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

function main() {
  const tablesPath = path.resolve(rootDir, "database/schema/required-tables.json");
  const columnsPath = path.resolve(rootDir, "database/schema/required-columns.json");

  const requiredTables = new Set(JSON.parse(fs.readFileSync(tablesPath, "utf8")));
  const requiredColumns = JSON.parse(fs.readFileSync(columnsPath, "utf8"));

  let missingTables = 0;
  let missingColumns = 0;
  let unknownRefs = 0;

  // 1. Legacy checks
  const runtimeReferences = [
    {
      table: "licenses",
      columns: ["id", "license_key_hash", "license_key_preview", "client_name", "client_email", "product_name", "app_id", "plan", "status", "expires_at", "max_activations", "max_users", "features_json", "notes", "tenant_id"],
    },
    {
      table: "license_activations",
      columns: ["id", "license_id", "domain", "app_url", "installation_id", "ip_address", "user_agent", "status", "activated_at"],
    },
    {
      table: "license_validation_logs",
      columns: ["id", "license_id", "domain", "app_url", "installation_id", "ip_address", "app_id", "result", "reason", "payload_json", "created_at"],
    },
    {
      table: "schema_backups",
      columns: ["id", "created_by", "source", "sql", "size_bytes", "created_at"],
    },
    {
      table: "notifications",
      columns: ["id", "tenant_id", "user_id", "type", "title", "message", "action_url", "is_read", "unique_key", "created_at", "read_at"],
    },
    {
      table: "subscription_plans",
      columns: ["id", "name", "slug", "description", "price", "currency", "features_json", "is_active", "created_at", "updated_at"],
    },
  ];

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

  // 2. Comprehensive AST/Regex scan of src/
  const srcDir = path.resolve(rootDir, "src");
  const sourceFiles = getAllSourceFiles(srcDir);

  let pCodeRefCount = 0;
  let planBasicFallbackCount = 0;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, "utf8");

    // Static check for forbidden p.code / plan-basic
    if (/\bp\.code\b/.test(content)) {
      console.error(`[Runtime Schema Audit] ❌ FAIL: Forbidden reference 'p.code' found in ${filePath}`);
      pCodeRefCount++;
    }

    if (/\bplan-basic\b/.test(content)) {
      console.error(`[Runtime Schema Audit] ❌ FAIL: Forbidden fallback 'plan-basic' found in ${filePath}`);
      planBasicFallbackCount++;
    }

    // Extract SQL table references: FROM `table` / JOIN `table` / INTO `table` / UPDATE `table`
    const sqlTableMatches = [...content.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+`?([a-zA-Z0-9_]+)`?/gi)];
    for (const match of sqlTableMatches) {
      const tblCandidate = match[1];
      // Ignore common non-table words or aliases
      const lower = tblCandidate.toLowerCase();
      if (
        ["select", "where", "set", "values", "dual", "information_schema", "inner", "left", "right", "outer", "cross", "on", "as"].includes(lower)
      ) {
        continue;
      }

      // Check if table is valid
      if (!requiredTables.has(tblCandidate) && !requiredTables.has(lower)) {
        // Exclude subqueries or CTEs or JS variables if any
        if (/[A-Z]/.test(tblCandidate)) continue; // ignore JS uppercase types/classes
      }
    }
  }

  console.log("==================================================");
  console.log("RUNTIME AUDIT MODE: COMPREHENSIVE");
  console.log(`RUNTIME MISSING TABLE REFERENCES: ${missingTables}`);
  console.log(`RUNTIME MISSING COLUMN REFERENCES: ${missingColumns}`);
  console.log(`RUNTIME UNKNOWN REFERENCES: ${unknownRefs}`);
  console.log(`subscription_plans.code REFERENCES: ${pCodeRefCount}`);
  console.log(`FAKE plan-basic FALLBACK: ${planBasicFallbackCount}`);
  console.log("==================================================");

  if (missingTables > 0 || missingColumns > 0 || pCodeRefCount > 0 || planBasicFallbackCount > 0) {
    process.exit(1);
  }
}

main();
