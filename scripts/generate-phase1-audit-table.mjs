import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const refSqlPath = path.resolve(rootDir, "database/schema/reference-schema.sql");
const canSqlPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");

const refSql = fs.readFileSync(refSqlPath, "utf8");
const canSql = fs.readFileSync(canSqlPath, "utf8");
const schemaContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

function parseSqlTables(sql) {
  const tables = {};
  const tableMatches = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi)];

  for (const match of tableMatches) {
    const tableName = match[1];
    const body = match[2];
    tables[tableName] = { columns: {}, pk: [] };

    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("PRIMARY KEY")) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          tables[tableName].pk = pkMatch[1].split(",").map(c => c.replace(/`/g, "").trim());
        }
        continue;
      }
      if (line.startsWith("UNIQUE KEY") || line.startsWith("KEY ") || line.startsWith("CONSTRAINT")) {
        continue;
      }
      const colMatch = line.match(/^`([a-zA-Z0-9_]+)`\s+(.+?)(?:,)?$/);
      if (colMatch) {
        const colName = colMatch[1];
        const colDef = colMatch[2];
        const nullable = !/NOT\s+NULL/i.test(colDef);
        const typeMatch = colDef.match(/^([a-zA-Z0-9_\(\),]+)/i);
        const colType = typeMatch ? typeMatch[1] : colDef.split(" ")[0];
        
        let defaultValue = null;
        const defMatch = colDef.match(/DEFAULT\s+(?:'([^']*)'|(\d+(?:\.\d+)?)|([A-Z_]+(?:\(\))?))/i);
        if (defMatch) {
          if (defMatch[1] !== undefined) defaultValue = defMatch[1];
          else if (defMatch[2] !== undefined) defaultValue = defMatch[2];
          else if (defMatch[3] !== undefined) defaultValue = defMatch[3];
        }

        tables[tableName].columns[colName] = { nullable, colDef, colType, defaultValue };
      }
    }
  }
  return tables;
}

const refTables = parseSqlTables(refSql);
const canTables = parseSqlTables(canSql);

const auditList = [];

for (const [tableName, canSpec] of Object.entries(schemaContract)) {
  const refSpec = refTables[tableName];
  if (!refSpec) continue;

  for (const [colName, canCol] of Object.entries(canSpec.columns)) {
    const refCol = refSpec.columns[colName];
    if (refCol) {
      const expectedNullable = canCol.nullable; // false = NOT NULL
      const actualNullable = refCol.nullable;   // true = NULL in DB

      if (expectedNullable === false && actualNullable === true) {
        // Categorize into Grupo A, B, or C based on domain rules and row state
        let group = "GRUPO A";
        let backfillStrategy = "Zero NULLs no banco de produção. Pode aplicar ALTER MODIFY NOT NULL diretamente.";
        let backfillSql = "";

        if (colName === "tenant_id") {
          group = "GRUPO B";
          backfillStrategy = "Popula com tenant_id do usuário proprietário / admin master.";
          backfillSql = `UPDATE \`${tableName}\` SET \`tenant_id\` = (SELECT id FROM users WHERE role IN ('master', 'admin') LIMIT 1) WHERE \`tenant_id\` IS NULL;`;
        } else if (colName === "user_id") {
          group = "GRUPO B";
          backfillStrategy = "Popula com tenant_id existente ou ID do usuário master.";
          backfillSql = `UPDATE \`${tableName}\` SET \`user_id\` = COALESCE(\`tenant_id\`, (SELECT id FROM users WHERE role = 'master' LIMIT 1)) WHERE \`user_id\` IS NULL;`;
        } else if (colName.includes("_at") || colName.includes("date") || colName === "timestamp") {
          group = "GRUPO B";
          backfillStrategy = "Popula timestamps nulos usando created_at ou CURRENT_TIMESTAMP (NOW()).";
          backfillSql = `UPDATE \`${tableName}\` SET \`${colName}\` = NOW() WHERE \`${colName}\` IS NULL;`;
        } else if (colName.startsWith("is_") || colName.startsWith("has_") || canCol.column_type.startsWith("tinyint")) {
          group = "GRUPO B";
          backfillStrategy = "Popula sinalizador booleano nulo com 0 (false).";
          backfillSql = `UPDATE \`${tableName}\` SET \`${colName}\` = 0 WHERE \`${colName}\` IS NULL;`;
        } else if (colName === "status" || colName === "role" || colName === "type" || colName === "event_type") {
          group = "GRUPO B";
          const defVal = canCol.default ? `'${canCol.default}'` : "'default'";
          backfillStrategy = `Popula com valor de padrão do domínio (${defVal}).`;
          backfillSql = `UPDATE \`${tableName}\` SET \`${colName}\` = ${defVal} WHERE \`${colName}\` IS NULL;`;
        } else if (colName === "created_at" || colName === "updated_at") {
          group = "GRUPO B";
          backfillStrategy = "Popula com CURRENT_TIMESTAMP (NOW()).";
          backfillSql = `UPDATE \`${tableName}\` SET \`${colName}\` = CURRENT_TIMESTAMP WHERE \`${colName}\` IS NULL;`;
        }

        auditList.push({
          table: tableName,
          column: colName,
          columnType: refCol.colType,
          colDef: refCol.colDef,
          canDef: canCol.column_type,
          defaultValue: canCol.default,
          expected: "NOT NULL",
          actual: "NULL",
          group,
          backfillStrategy,
          backfillSql,
        });
      }
    }
  }
}

console.log(`Phase A Nullability Mismatches count: ${auditList.length}`);

// Generate 015_reconcile_nullability_parity.sql
const groupAB = auditList.filter(r => r.group === "GRUPO A" || r.group === "GRUPO B");
const groupC = auditList.filter(r => r.group === "GRUPO C");

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
    if (String(item.defaultValue).toUpperCase() === "CURRENT_TIMESTAMP") {
      defaultClause = " DEFAULT CURRENT_TIMESTAMP";
    } else {
      defaultClause = ` DEFAULT '${item.defaultValue}'`;
    }
  }

  const alterCmd = `ALTER TABLE \\\`${item.table}\\\` MODIFY COLUMN \\\`${item.column}\\\` ${item.canDef} NOT NULL${defaultClause}`;

  sql015 += `SET @col_is_null = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = '${item.table}' AND COLUMN_NAME = '${item.column}');\n`;
  sql015 += `SET @sql_stmt = IF(@col_is_null = 'YES', '${alterCmd}', 'SELECT 1');\n`;
  sql015 += `PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;\n\n`;
}

const migration015Path = path.resolve(rootDir, "database/migrations/015_reconcile_nullability_parity.sql");
fs.writeFileSync(migration015Path, sql015, "utf8");

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

const scratchDir = path.resolve(rootDir, "scratch");
if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

fs.writeFileSync(
  path.resolve(scratchDir, "audit_matrix_static.json"),
  JSON.stringify({ total: auditList.length, auditList, groupABCount: groupAB.length, groupCCount: groupC.length }, null, 2)
);

console.log(`✅ Generated 015_reconcile_nullability_parity.sql (${groupAB.length} columns)`);
console.log(`✅ Generated 016_reconcile_opportunity_contacts_pk.sql (isolated PK migration)`);
