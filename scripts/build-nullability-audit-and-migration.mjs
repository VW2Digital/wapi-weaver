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
  console.log("=== EXECUTING PHASE 1 AUDIT & MIGRATION GENERATION ===");

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }

  const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");
  const schemaContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

  const [tableRows] = await connection.query("SHOW TABLES");
  const physicalTables = new Set(tableRows.map((t) => Object.values(t)[0]));

  const auditResults = [];

  for (const [table, spec] of Object.entries(schemaContract)) {
    if (!physicalTables.has(table)) continue;

    const [colRows] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database, table]);

    const existingCols = new Map(colRows.map((c) => [c.COLUMN_NAME, c]));
    const expectedCols = spec.columns;

    for (const [colName, colSpec] of Object.entries(expectedCols)) {
      const physicalCol = existingCols.get(colName);
      if (physicalCol) {
        const expectedNullable = colSpec.nullable; // false = NOT NULL in canonical
        const actualNullable = physicalCol.IS_NULLABLE === "YES"; // true = NULL in DB

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
            console.error(`Error querying count for ${table}.${colName}:`, err.message);
          }

          let group = "GRUPO A";
          let backfillSql = "";
          let backfillStrategy = "N/A (zero NULLs encontrados)";

          if (nullCount > 0) {
            // Strategic backfill rules
            if (colName === "tenant_id") {
              group = "GRUPO B";
              backfillSql = `UPDATE \`${table}\` SET \`tenant_id\` = (SELECT id FROM users WHERE role = 'master' OR role = 'admin' LIMIT 1) WHERE \`tenant_id\` IS NULL;`;
              backfillStrategy = "Popula com ID do tenant master/admin padrão";
            } else if (colName === "user_id") {
              group = "GRUPO B";
              backfillSql = `UPDATE \`${table}\` SET \`user_id\` = COALESCE(\`tenant_id\`, (SELECT id FROM users WHERE role = 'master' LIMIT 1)) WHERE \`user_id\` IS NULL;`;
              backfillStrategy = "Popula com tenant_id ou ID do usuário master";
            } else if (colName.includes("_at") || colName.includes("date")) {
              group = "GRUPO B";
              backfillSql = `UPDATE \`${table}\` SET \`${colName}\` = NOW() WHERE \`${colName}\` IS NULL;`;
              backfillStrategy = "Popula timestamps nulos com data/hora corrente (NOW())";
            } else if (colName.startsWith("is_") || colName.startsWith("has_") || physicalCol.COLUMN_TYPE.startsWith("tinyint")) {
              group = "GRUPO B";
              backfillSql = `UPDATE \`${table}\` SET \`${colName}\` = 0 WHERE \`${colName}\` IS NULL;`;
              backfillStrategy = "Popula sinalizador booleano nulo com 0 (false)";
            } else if (colName === "status" || colName === "role" || colName === "type" || colName === "event_type") {
              group = "GRUPO B";
              const defaultVal = colSpec.default || "'default'";
              backfillSql = `UPDATE \`${table}\` SET \`${colName}\` = ${defaultVal} WHERE \`${colName}\` IS NULL;`;
              backfillStrategy = `Popula com valor de padrão do domínio (${defaultVal})`;
            } else {
              group = "GRUPO C";
              backfillStrategy = "DADO AMBÍGUO OU ÓRFÃO: Requer decisão manual do usuário. Mantido nulo temporariamente.";
            }
          }

          auditResults.push({
            table,
            column: colName,
            columnType: physicalCol.COLUMN_TYPE,
            charset: physicalCol.CHARACTER_SET_NAME,
            collation: physicalCol.COLLATION_NAME,
            defaultValue: physicalCol.COLUMN_DEFAULT,
            extra: physicalCol.EXTRA,
            expectedNullable: "NOT NULL",
            actualNullable: "NULL",
            totalRows,
            nullCount,
            group,
            backfillSql,
            backfillStrategy,
          });
        }
      }
    }
  }

  // Phase 2: Inspect opportunity_contacts
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

  const hasIdCol = oppCols.some((c) => c.COLUMN_NAME === "id");

  // Output audit JSON
  const scratchDir = path.resolve(rootDir, "scratch");
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  fs.writeFileSync(
    path.resolve(scratchDir, "audit_phase1_complete.json"),
    JSON.stringify({ auditResults, opportunityContacts: { actualOppPK, hasIdCol, oppCols } }, null, 2)
  );

  console.log(`✅ AUDIT COMPLETE: ${auditResults.length} nullability mismatches processed.`);
  console.log(`   - GRUPO A: ${auditResults.filter(r => r.group === "GRUPO A").length}`);
  console.log(`   - GRUPO B: ${auditResults.filter(r => r.group === "GRUPO B").length}`);
  console.log(`   - GRUPO C: ${auditResults.filter(r => r.group === "GRUPO C").length}`);
  console.log(`   - opportunity_contacts PK: [${actualOppPK}], has 'id' column: ${hasIdCol}`);

  // Generate 015_reconcile_nullability_parity.sql
  const groupAB = auditResults.filter((r) => r.group === "GRUPO A" || r.group === "GRUPO B");

  let sql015 = `-- Migration 015: Reconcile nullability parity (Phase A) for Grupo A and Grupo B columns
-- Idempotent DDL updates and pre-audit backfills to align DB columns with canonical schema

SET @dbname = DATABASE();

`;

  for (const item of groupAB) {
    sql015 += `-- ${item.table}.${item.column}\n`;
    if (item.backfillSql) {
      sql015 += `${item.backfillSql}\n`;
    }

    let defaultClause = "";
    if (item.defaultValue !== null && item.defaultValue !== undefined) {
      if (item.defaultValue.toUpperCase() === "CURRENT_TIMESTAMP") {
        defaultClause = " DEFAULT CURRENT_TIMESTAMP";
      } else {
        defaultClause = ` DEFAULT '${item.defaultValue}'`;
      }
    }

    let extraClause = "";
    if (item.extra && item.extra.toUpperCase().includes("ON UPDATE CURRENT_TIMESTAMP")) {
      extraClause = " ON UPDATE CURRENT_TIMESTAMP";
    }

    let charsetCollation = "";
    if (item.charset && item.collation) {
      charsetCollation = ` CHARACTER SET ${item.charset} COLLATE ${item.collation}`;
    }

    const alterCmd = `ALTER TABLE \\\`${item.table}\\\` MODIFY COLUMN \\\`${item.column}\\\` ${item.columnType}${charsetCollation} NOT NULL${defaultClause}${extraClause}`;

    sql015 += `SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = '${item.table}' AND COLUMN_NAME = '${item.column}');\n`;
    sql015 += `SET @sql_stmt = IF(@col_is_null = 'YES', '${alterCmd}', 'SELECT 1');\n`;
    sql015 += `PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;\n\n`;
  }

  const migration015Path = path.resolve(rootDir, "database/migrations/015_reconcile_nullability_parity.sql");
  fs.writeFileSync(migration015Path, sql015, "utf8");
  console.log(`✅ Generated migration file: ${migration015Path}`);

  // Generate 016_reconcile_opportunity_contacts_pk.sql
  let sql016 = `-- Migration 016: Reconcile opportunity_contacts Primary Key (Phase A)
-- Isolated migration to align PK from composite (opportunity_id, contact_id) to (id)

SET @dbname = DATABASE();

-- 1. Garante que a coluna 'id' existe
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND COLUMN_NAME = 'id');
SET @sql_stmt = IF(@col_exists = 0, 'ALTER TABLE \`opportunity_contacts\` ADD COLUMN \`id\` varchar(36) NOT NULL FIRST', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Popula IDs nulos/vazios com UUID() de forma segura
UPDATE \`opportunity_contacts\` SET \`id\` = UUID() WHERE \`id\` IS NULL OR \`id\` = '';

-- 3. Valida a chave primária atual antes de alterar
SET @pk_is_id = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'opportunity_contacts' AND CONSTRAINT_NAME = 'PRIMARY' AND COLUMN_NAME = 'id'
);

-- 4. Se a PK ainda for a chave composta legada, executa a troca segura
SET @sql_stmt = IF(@pk_is_id = 0, 'ALTER TABLE \`opportunity_contacts\` DROP PRIMARY KEY, ADD PRIMARY KEY (\`id\`), ADD UNIQUE KEY \`uq_opportunity_contact\` (\`opportunity_id\`,\`contact_id\`)', 'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
`;

  const migration016Path = path.resolve(rootDir, "database/migrations/016_reconcile_opportunity_contacts_pk.sql");
  fs.writeFileSync(migration016Path, sql016, "utf8");
  console.log(`✅ Generated migration file: ${migration016Path}`);

  await connection.end();
}

main().catch(console.error);
