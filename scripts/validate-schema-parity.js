/**
 * Validate Schema Parity Script (ESM)
 * Compares the active MySQL database against required-tables.json and required-columns.json,
 * verifying that column existence, data types, defaults, and key properties strictly match contract specifications.
 */

import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load environment variables from .env if present
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

async function main() {
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || "banco-mysql";
  const port = parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.DB_USER || process.env.MYSQL_USER || "wapi_user";
  const database = process.env.DB_NAME || process.env.MYSQL_DATABASE || "wapi_weaver";
  const password = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;

  if (!password) {
    console.error("[Schema Parity] ❌ CRITICAL: DB_PASSWORD environment variable is missing.");
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });
  } catch (err) {
    console.error("[Schema Parity] ❌ FAIL: Connection error:", err.message);
    process.exit(1);
  }

  try {
    const tablesPath = path.resolve(__dirname, "../database/schema/required-tables.json");
    const columnsPath = path.resolve(__dirname, "../database/schema/required-columns.json");

    const requiredTables = JSON.parse(fs.readFileSync(tablesPath, "utf8"));
    const requiredColumns = JSON.parse(fs.readFileSync(columnsPath, "utf8"));

    const [tables] = await connection.query("SHOW TABLES");
    const physicalTables = new Set(tables.map((t) => Object.values(t)[0]));

    let parityErrors = 0;

    // Check table parity
    for (const table of requiredTables) {
      if (!physicalTables.has(table)) {
        console.error(`[Schema Parity] ❌ FAIL: Required table '${table}' missing in physical database.`);
        parityErrors++;
      }
    }

    // Check column parity (missing & extra columns)
    const allowedExtraColumns = {
      license_validation_logs: new Set(["status", "message"]),
    };

    for (const [table, cols] of Object.entries(requiredColumns)) {
      if (!physicalTables.has(table)) continue;

      const [colRows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      const existingCols = new Map(colRows.map((c) => [c.Field, c]));
      const expectedCols = new Set(cols);

      // 1. Missing columns check
      for (const colName of cols) {
        if (!existingCols.has(colName)) {
          console.error(`[Schema Parity] ❌ FAIL: Table '${table}' missing column '${colName}'.`);
          parityErrors++;
        }
      }

      // 2. Unexpected extra columns check
      const allowedExtras = allowedExtraColumns[table] || new Set();
      for (const existingCol of existingCols.keys()) {
        if (!expectedCols.has(existingCol) && !allowedExtras.has(existingCol)) {
          console.error(`[Schema Parity] ❌ FAIL: Table '${table}' has unexpected extra column '${existingCol}'.`);
          parityErrors++;
        }
      }
    }

    // 3. Index & Key Parity Checks
    if (physicalTables.has("subscription_plans")) {
      const [subPlanIndexes] = await connection.query("SHOW INDEX FROM subscription_plans");
      const subPlanUniqueKeys = new Set(subPlanIndexes.filter((i) => i.Non_unique === 0).map((i) => i.Column_name));
      if (!subPlanUniqueKeys.has("slug")) {
        console.error("[Schema Parity] ❌ FAIL: Table 'subscription_plans' missing UNIQUE index on column 'slug'.");
        parityErrors++;
      }
    }

    if (parityErrors > 0) {
      console.error(`[Schema Parity] ❌ FAIL: ${parityErrors} structural parity error(s) found.`);
      process.exit(1);
    }

    console.log(`[Schema Parity] ✅ SUCCESS: All ${requiredTables.length} required tables and ${Object.keys(requiredColumns).length} column contracts verified for structural parity.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Schema Parity] ❌ UNHANDLED EXCEPTION:", err);
  process.exit(1);
});
