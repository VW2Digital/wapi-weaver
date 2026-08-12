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

  const auditMatrix = [];

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

        // Mismatch: expected NOT NULL (nullable=false), but DB is NULL (actualNullable=true)
        if (expectedNullable === false && actualNullable === true) {
          let totalRows = 0;
          let nullCount = 0;

          try {
            const [countRes] = await connection.query(`
              SELECT COUNT(*) as total_rows, 
                     SUM(CASE WHEN \`${colName}\` IS NULL THEN 1 ELSE 0 END) as null_count
              FROM \`${table}\`
            `);
            totalRows = Number(countRes[0]?.total_rows || 0);
            nullCount = Number(countRes[0]?.null_count || 0);
          } catch (err) {
            console.error(`Error querying ${table}.${colName}:`, err.message);
          }

          let group = "GRUPO A";
          let backfillStrategy = "N/A (zero NULLs encontrados)";

          if (nullCount > 0) {
            // Determine if backfill can be inferred safely
            if (colName === "tenant_id" || colName === "user_id") {
              group = "GRUPO B";
              backfillStrategy = `Backfill via JOIN com tabela proprietária/relacionada ou admin por padrão`;
            } else if (colName.includes("_at") || colName.includes("date")) {
              group = "GRUPO B";
              backfillStrategy = `Backfill usando created_at ou NOW() como data padrão`;
            } else if (colName === "is_active" || colName.startsWith("is_") || colName.startsWith("has_")) {
              group = "GRUPO B";
              backfillStrategy = `Backfill usando valor booleano padrão 0 (false) ou 1 (true)`;
            } else if (colName === "status" || colName === "role" || colName === "type") {
              group = "GRUPO B";
              backfillStrategy = `Backfill usando valor padrão de domínio constante`;
            } else {
              group = "GRUPO C";
              backfillStrategy = `ATENÇÃO: Dado ambíguo / órfão. Requer decisão manual do usuário.`;
            }
          }

          auditMatrix.push({
            table,
            column: colName,
            columnType: physicalCol.COLUMN_TYPE,
            expectedNullable: "NOT NULL",
            actualNullable: "NULL",
            totalRows,
            nullCount,
            group,
            backfillStrategy,
          });
        }
      }
    }
  }

  // Opportunity contacts PK check
  const [oppPkRows] = await connection.query(`
    SELECT COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'opportunity_contacts' AND CONSTRAINT_NAME = 'PRIMARY'
    ORDER BY ORDINAL_POSITION
  `, [dbConfig.database]);
  const actualOppPK = oppPkRows.map((r) => r.COLUMN_NAME).join(",");

  const [oppCols] = await connection.query(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'opportunity_contacts'
  `, [dbConfig.database]);
  const hasIdColumn = oppCols.some((c) => c.COLUMN_NAME === "id");

  const scratchDir = path.resolve(rootDir, "scratch");
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  fs.writeFileSync(
    path.resolve(scratchDir, "phase_a_audit_matrix.json"),
    JSON.stringify({ auditMatrix, opportunityContacts: { actualOppPK, hasIdColumn, cols: oppCols } }, null, 2)
  );

  console.log(`AUDIT_MATRIX_GENERATED: Total nullability mismatches = ${auditMatrix.length}`);
  await connection.end();
}

main().catch(console.error);
