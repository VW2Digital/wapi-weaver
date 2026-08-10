/**
 * Generate Schema Contract Script (ESM)
 * Connects to local MySQL database and programmatically generates:
 * 1. database/schema/schema-contract.json
 * 2. database/schema/required-tables.json
 * 3. database/schema/required-columns.json
 * 4. database/schema/reference-schema.sql
 * 5. database/schema/canonical-schema.sql
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
    console.error("[Generate Schema Contract] ❌ CRITICAL: DB_PASSWORD environment variable is missing.");
    process.exit(1);
  }

  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    console.log(`[Generate Schema Contract] Connected to database '${database}' on ${host}:${port}...`);

    const [tablesRows] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      [database]
    );
    const allPhysicalTables = tablesRows.map((r) => r.TABLE_NAME);
    const functionalTables = allPhysicalTables.filter((t) => t !== "schema_migrations");

    const [columnsRows] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = '${database}'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const [pksRows] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = '${database}' AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const [fksRows] = await connection.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = '${database}' AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);

    const [indexesRows] = await connection.query(`
      SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = '${database}'
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `);

    const schemaContract = {};

    for (const t of functionalTables) {
      schemaContract[t] = {
        columns: {},
        primary_key: [],
        unique_indexes: {},
        indexes: {},
        foreign_keys: [],
      };
    }

    for (const row of columnsRows) {
      if (row.TABLE_NAME === "schema_migrations") continue;
      if (!schemaContract[row.TABLE_NAME]) continue;
      schemaContract[row.TABLE_NAME].columns[row.COLUMN_NAME] = {
        ordinal_position: row.ORDINAL_POSITION,
        data_type: row.DATA_TYPE,
        column_type: row.COLUMN_TYPE,
        nullable: row.IS_NULLABLE === "YES",
        default: row.COLUMN_DEFAULT,
        key: row.COLUMN_KEY,
        extra: row.EXTRA,
        charset: row.CHARACTER_SET_NAME,
        collation: row.COLLATION_NAME,
      };
    }

    for (const row of pksRows) {
      if (row.TABLE_NAME === "schema_migrations") continue;
      if (schemaContract[row.TABLE_NAME]) {
        schemaContract[row.TABLE_NAME].primary_key.push(row.COLUMN_NAME);
      }
    }

    for (const row of fksRows) {
      if (row.TABLE_NAME === "schema_migrations") continue;
      if (schemaContract[row.TABLE_NAME]) {
        schemaContract[row.TABLE_NAME].foreign_keys.push({
          column: row.COLUMN_NAME,
          ref_table: row.REFERENCED_TABLE_NAME,
          ref_column: row.REFERENCED_COLUMN_NAME,
          constraint_name: row.CONSTRAINT_NAME,
        });
      }
    }

    for (const row of indexesRows) {
      if (row.TABLE_NAME === "schema_migrations") continue;
      if (schemaContract[row.TABLE_NAME]) {
        if (row.INDEX_NAME === "PRIMARY") continue;
        const targetDict = row.NON_UNIQUE === 0 ? schemaContract[row.TABLE_NAME].unique_indexes : schemaContract[row.TABLE_NAME].indexes;
        if (!targetDict[row.INDEX_NAME]) {
          targetDict[row.INDEX_NAME] = [];
        }
        targetDict[row.INDEX_NAME].push(row.COLUMN_NAME);
      }
    }

    // 1. Write schema-contract.json
    const contractPath = path.resolve(__dirname, "../database/schema/schema-contract.json");
    fs.writeFileSync(contractPath, JSON.stringify(schemaContract, null, 2), "utf8");

    // 2. Write required-tables.json
    const reqTablesPath = path.resolve(__dirname, "../database/schema/required-tables.json");
    fs.writeFileSync(reqTablesPath, JSON.stringify(functionalTables, null, 2), "utf8");

    // 3. Write required-columns.json
    const reqColsMap = {};
    for (const t of functionalTables) {
      reqColsMap[t] = Object.keys(schemaContract[t].columns);
    }
    const reqColsPath = path.resolve(__dirname, "../database/schema/required-columns.json");
    fs.writeFileSync(reqColsPath, JSON.stringify(reqColsMap, null, 2), "utf8");

    // 4. Generate reference-schema.sql and canonical-schema.sql DDL
    let ddlSql = `-- REFERENCE SCHEMA (DDL ONLY - SINGLE SOURCE OF TRUTH FROM LOCAL MYSQL)\n`;
    ddlSql += `-- Generated at ${new Date().toISOString()}\n\n`;

    for (const t of functionalTables) {
      const [createSqlRows] = await connection.query(`SHOW CREATE TABLE \`${t}\``);
      let createStmt = createSqlRows[0]?.["Create Table"] || "";
      createStmt = createStmt.replace(/AUTO_INCREMENT=\d+\s*/g, "");
      ddlSql += `${createStmt};\n\n`;
    }

    const referencePath = path.resolve(__dirname, "../database/schema/reference-schema.sql");
    fs.writeFileSync(referencePath, ddlSql, "utf8");

    const canonicalPath = path.resolve(__dirname, "../database/schema/canonical-schema.sql");
    const canonicalSql = ddlSql.replace(/CREATE TABLE `/g, "CREATE TABLE IF NOT EXISTS `");
    fs.writeFileSync(canonicalPath, canonicalSql, "utf8");

    console.log(`[Generate Schema Contract] ✅ SUCCESS: Generated contracts and manifests for ${functionalTables.length} functional tables.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("[Generate Schema Contract] ❌ UNHANDLED EXCEPTION:", err);
  process.exit(1);
});
