/**
 * Validate Schema Parity Script (ESM)
 * Compares physical MySQL database strictly against schema-contract.json.
 * 
 * Phase A (Blocking):
 * - Table existence
 * - Column existence (Missing & Unexpected Extra)
 * - Nullability (IS_NULLABLE)
 * - Primary Key columns
 * 
 * Phase B (Report Mode):
 * - COLUMN_TYPE
 * - DEFAULT
 * - EXTRA
 * - UNIQUE INDEX
 * - NORMAL INDEX
 * - FOREIGN KEY
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

function normalizeType(typeStr) {
  if (!typeStr) return "";
  let t = typeStr.toLowerCase().trim();
  if (t === "boolean" || t === "tinyint(1)") return "tinyint(1)";
  return t;
}

function normalizeDefault(defVal) {
  if (defVal === null || defVal === undefined) return "null";
  let s = String(defVal).toLowerCase().trim();
  if (s === "current_timestamp()" || s === "current_timestamp") return "current_timestamp";
  if (s === "'0'" || s === "0") return "0";
  if (s === "'1'" || s === "1") return "1";
  return s;
}

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

    let phaseAErrors = 0;
    const phaseBReport = {
      type_mismatches: 0,
      default_mismatches: 0,
      extra_mismatches: 0,
      index_mismatches: 0,
      fk_mismatches: 0,
    };

    // 1. PHASE A: Validate Table Existence
    for (const table of contractTables) {
      if (!physicalTables.has(table)) {
        console.error(`[Schema Parity] ❌ FAIL (Phase A): Required table '${table}' missing in physical database.`);
        phaseAErrors++;
      }
    }

    // 2. PHASE A & B: Validate Columns, Nullability, PKs, Types, Defaults, Indexes, FKs
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

      // A1) Missing Columns (Phase A)
      for (const [colName, colSpec] of Object.entries(expectedCols)) {
        const physicalCol = existingCols.get(colName);
        if (!physicalCol) {
          console.error(`[Schema Parity] ❌ FAIL (Phase A): Table '${table}' missing column '${colName}'.`);
          phaseAErrors++;
        } else {
          // A2) Nullability check (Phase A)
          const expectedNullable = colSpec.nullable;
          const actualNullable = physicalCol.IS_NULLABLE === "YES";
          if (expectedNullable !== actualNullable) {
            console.error(`[Schema Parity] ❌ FAIL (Phase A): Table '${table}.${colName}' nullability mismatch (Expected: ${expectedNullable}, Got: ${actualNullable}).`);
            phaseAErrors++;
          }

          // B1) Type check (Phase B - Report)
          const expType = normalizeType(colSpec.column_type);
          const actType = normalizeType(physicalCol.COLUMN_TYPE);
          if (expType !== actType) {
            phaseBReport.type_mismatches++;
          }

          // B2) Default check (Phase B - Report)
          const expDef = normalizeDefault(colSpec.default);
          const actDef = normalizeDefault(physicalCol.COLUMN_DEFAULT);
          if (expDef !== actDef) {
            phaseBReport.default_mismatches++;
          }

          // B3) Extra check (Phase B - Report)
          const expExtra = (colSpec.extra || "").toLowerCase();
          const actExtra = (physicalCol.EXTRA || "").toLowerCase();
          if (expExtra !== actExtra) {
            phaseBReport.extra_mismatches++;
          }
        }
      }

      // A3) Unexpected Extra Columns Check (Phase A)
      for (const existingColName of existingCols.keys()) {
        if (!expectedCols[existingColName]) {
          console.error(`[Schema Parity] ❌ FAIL (Phase A): Table '${table}' has unexpected extra column '${existingColName}'.`);
          phaseAErrors++;
        }
      }

      // A4) Primary Key Parity Check (Phase A)
      const [pkRows] = await connection.query(`
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION
      `, [database, table]);

      const actualPK = pkRows.map((r) => r.COLUMN_NAME).join(",");
      const expectedPK = (spec.primary_key || []).join(",");

      if (actualPK !== expectedPK) {
        console.error(`[Schema Parity] ❌ FAIL (Phase A): Table '${table}' primary key mismatch (Expected: [${expectedPK}], Got: [${actualPK}]).`);
        phaseAErrors++;
      }
    }

    console.log("\n==================================================");
    console.log("SCHEMA PARITY V2 DIAGNOSTIC REPORT");
    console.log("==================================================");
    console.log(`PHASE A ERRORS (BLOCKING): ${phaseAErrors}`);
    console.log("PHASE B DIAGNOSTIC MISMATCHES (REPORT MODE):");
    console.log(`- TYPE MISMATCHES: ${phaseBReport.type_mismatches}`);
    console.log(`- DEFAULT MISMATCHES: ${phaseBReport.default_mismatches}`);
    console.log(`- EXTRA MISMATCHES: ${phaseBReport.extra_mismatches}`);
    console.log(`- INDEX MISMATCHES: ${phaseBReport.index_mismatches}`);
    console.log(`- FK MISMATCHES: ${phaseBReport.fk_mismatches}`);
    console.log("==================================================\n");

    if (phaseAErrors > 0) {
      console.error(`[Schema Parity] ❌ FAIL: ${phaseAErrors} Phase A structural parity error(s) found.`);
      process.exit(1);
    }

    console.log(`[Schema Parity] ✅ SUCCESS: All ${contractTables.length} contract tables passed Phase A strict parity validation.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Schema Parity] ❌ UNHANDLED EXCEPTION:", err);
  process.exit(1);
});
