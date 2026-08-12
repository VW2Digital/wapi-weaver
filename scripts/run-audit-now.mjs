import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env
const dotenvPath = path.resolve(rootDir, ".env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const eqIdx = trimmed.indexOf("=");
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  const connection = await mysql.createConnection(dbConfig);
  const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");
  const schemaContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

  const [tableRows] = await connection.query("SHOW TABLES");
  const physicalTables = new Set(tableRows.map((t) => Object.values(t)[0]));

  const nullabilityMismatches = [];
  const pkMismatches = [];

  for (const [table, spec] of Object.entries(schemaContract)) {
    if (!physicalTables.has(table)) continue;

    const [colRows] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database, table]);

    const existingCols = new Map(colRows.map((c) => [c.COLUMN_NAME, c]));
    const expectedCols = spec.columns;

    for (const [colName, colSpec] of Object.entries(expectedCols)) {
      const physicalCol = existingCols.get(colName);
      if (physicalCol) {
        const expectedNullable = colSpec.nullable;
        const actualNullable = physicalCol.IS_NULLABLE === "YES";
        if (expectedNullable !== actualNullable) {
          let totalRows = 0;
          let nullCount = 0;
          try {
            const [countRes] = await connection.query(`
              SELECT COUNT(*) as total_rows, 
                     SUM(CASE WHEN \`${colName}\` IS NULL THEN 1 ELSE 0 END) as null_count
              FROM \`${table}\`
            `);
            totalRows = Number(countRes[0].total_rows || 0);
            nullCount = Number(countRes[0].null_count || 0);
          } catch (err) {
            console.error(`Error querying ${table}.${colName}:`, err.message);
          }

          nullabilityMismatches.push({
            table,
            column: colName,
            expectedNullable,
            actualNullable,
            columnType: physicalCol.COLUMN_TYPE,
            totalRows,
            nullCount,
          });
        }
      }
    }

    // PK check
    const [pkRows] = await connection.query(`
      SELECT COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database, table]);

    const actualPK = pkRows.map((r) => r.COLUMN_NAME).join(",");
    const expectedPK = (spec.primary_key || []).join(",");

    if (actualPK !== expectedPK) {
      pkMismatches.push({
        table,
        expectedPK,
        actualPK,
      });
    }
  }

  // Inspect opportunity_contacts specifically
  const [oppCols] = await connection.query("DESCRIBE `opportunity_contacts`");
  const [oppKeys] = await connection.query("SHOW KEYS FROM `opportunity_contacts`");

  const outputDir = path.resolve(rootDir, "scratch");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.resolve(outputDir, "nullability_audit_results.json"),
    JSON.stringify({ nullabilityMismatches, pkMismatches }, null, 2)
  );

  fs.writeFileSync(
    path.resolve(outputDir, "opportunity_contacts_describe.json"),
    JSON.stringify({ oppCols, oppKeys }, null, 2)
  );

  console.log("AUDIT_RUNNER_COMPLETE");
  await connection.end();
}

main().catch(console.error);
