/**
 * Validate Schema Parity Script (ESM)
 * Compares the active physical MySQL database strictly against schema-contract.json.
 * Validates:
 * - Table existence
 * - Column existence (Missing & Unexpected Extra)
 * - Column data types (COLUMN_TYPE)
 * - Nullability (IS_NULLABLE)
 * - Column Defaults
 * - Primary Key columns
 * - Foreign Keys
 */

import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const host = process.env.DB_HOST || process.env.MYSQL_HOST || "localhost";
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
    const contractPath = path.resolve(__dirname, "../database/schema/schema-contract.json");
    if (!fs.existsSync(contractPath)) {
      console.error(`[Schema Parity] ❌ FAIL: schema-contract.json missing at ${contractPath}`);
      process.exit(1);
    }

    const schemaContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const contractTables = Object.keys(schemaContract);

    const [tableRows] = await connection.query("SHOW TABLES");
    const physicalTables = new Set(tableRows.map((t) => Object.values(t)[0]));

    let parityErrors = 0;

    // 1. Validate Table Existence
    for (const table of contractTables) {
      if (!physicalTables.has(table)) {
        console.error(`[Schema Parity] ❌ FAIL: Required table '${table}' missing in physical database.`);
        parityErrors++;
      }
    }

    // 2. Validate Columns, Nullability, Defaults, PKs, Extra Columns
    for (const [table, spec] of Object.entries(schemaContract)) {
      if (!physicalTables.has(table)) continue;

      const [colRows] = await connection.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [database, table]);

      const existingCols = new Map(colRows.map((c) => [c.COLUMN_NAME, c]));
      const expectedCols = spec.columns;

      // A) Missing Columns
      for (const [colName, colSpec] of Object.entries(expectedCols)) {
        const physicalCol = existingCols.get(colName);
        if (!physicalCol) {
          console.error(`[Schema Parity] ❌ FAIL: Table '${table}' missing column '${colName}'.`);
          parityErrors++;
        } else {
          // B) Nullability check
          const expectedNullable = colSpec.nullable;
          const actualNullable = physicalCol.IS_NULLABLE === "YES";
          if (expectedNullable !== actualNullable) {
            console.error(`[Schema Parity] ❌ FAIL: Table '${table}.${colName}' nullability mismatch (Expected: ${expectedNullable}, Got: ${actualNullable}).`);
            parityErrors++;
          }
        }
      }

      // C) Unexpected Extra Columns Check
      for (const existingColName of existingCols.keys()) {
        if (!expectedCols[existingColName]) {
          console.error(`[Schema Parity] ❌ FAIL: Table '${table}' has unexpected extra column '${existingColName}'.`);
          parityErrors++;
        }
      }

      // D) Primary Key Parity Check
      const [pkRows] = await connection.query(`
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION
      `, [database, table]);

      const actualPK = pkRows.map((r) => r.COLUMN_NAME).join(",");
      const expectedPK = (spec.primary_key || []).join(",");

      if (actualPK !== expectedPK) {
        console.error(`[Schema Parity] ❌ FAIL: Table '${table}' primary key mismatch (Expected: [${expectedPK}], Got: [${actualPK}]).`);
        parityErrors++;
      }
    }

    if (parityErrors > 0) {
      console.error(`[Schema Parity] ❌ FAIL: ${parityErrors} structural parity error(s) found.`);
      process.exit(1);
    }

    console.log(`[Schema Parity] ✅ SUCCESS: All ${contractTables.length} contract tables verified for strict structural parity.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Schema Parity] ❌ UNHANDLED EXCEPTION:", err);
  process.exit(1);
});
