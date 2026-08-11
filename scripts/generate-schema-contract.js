/**
 * Generate Schema Contract Script (ESM)
 * Reads from canonical-schema.sql (single source of truth) and generates:
 * 1. database/schema/schema-contract.json
 * 2. database/schema/required-tables.json
 * 3. database/schema/required-columns.json
 * 4. database/schema/reference-schema.sql
 *
 * Does NOT connect to a live database — canonical-schema.sql is the master.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");
const reqTablesPath = path.resolve(rootDir, "database/schema/required-tables.json");
const reqColsPath = path.resolve(rootDir, "database/schema/required-columns.json");
const referencePath = path.resolve(rootDir, "database/schema/reference-schema.sql");

if (!fs.existsSync(canonicalPath)) {
  console.error(`[Generate Schema Contract] ❌ CRITICAL: canonical-schema.sql not found at ${canonicalPath}`);
  process.exit(1);
}

const canonicalSql = fs.readFileSync(canonicalPath, "utf8");

// ─── Parser ─────────────────────────────────────────────────────────────────

function parseCanonical(sql) {
  const schemaContract = {};
  const functionalTables = [];

  // Split by CREATE TABLE block boundaries
  const tableMatches = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi)];

  for (const tableMatch of tableMatches) {
    const tableName = tableMatch[1];
    const bodyRaw = tableMatch[2];

    if (tableName === "schema_migrations") continue;

    functionalTables.push(tableName);
    schemaContract[tableName] = {
      columns: {},
      primary_key: [],
      unique_indexes: {},
      indexes: {},
      foreign_keys: [],
    };

    const lines = bodyRaw.split("\n").map(l => l.trim()).filter(Boolean);
    let ordinal = 1;

    for (const line of lines) {
      // Skip if this is a constraint/key line (starts with keywords)
      const isConstraintLine =
        line.startsWith("PRIMARY KEY") ||
        line.startsWith("UNIQUE KEY") ||
        line.startsWith("KEY ") ||
        line.startsWith("CONSTRAINT") ||
        line.startsWith("INDEX ");

      // ─── Column definition ────────────────────────────────────────────────
      if (!isConstraintLine) {
        const colMatch = line.match(/^`([a-zA-Z0-9_]+)`\s+(.+?)(?:,)?$/);
        if (colMatch) {
          const colName = colMatch[1];
          const colDef = colMatch[2];

          // Determine data type (first token up to first '(' or space)
          const typeMatch = colDef.match(/^([a-zA-Z]+(?:\([^)]*\))?(?:\s+unsigned)?)/i);
          const columnType = typeMatch ? typeMatch[1].toLowerCase().trim() : colDef.split(" ")[0].toLowerCase();
          const dataType = columnType.split("(")[0].toLowerCase();

          const nullable = !/NOT\s+NULL/i.test(colDef);

          let defaultValue = null;
          const defMatch = colDef.match(/DEFAULT\s+(?:'([^']*)'|(\d+(?:\.\d+)?)|([A-Z_]+(?:\(\))?))/i);
          if (defMatch) {
            if (defMatch[1] !== undefined) defaultValue = defMatch[1];
            else if (defMatch[2] !== undefined) defaultValue = defMatch[2];
            else if (defMatch[3] !== undefined) defaultValue = defMatch[3].replace(/\(\)$/, "");
          }
          if (/DEFAULT\s+NULL/i.test(colDef)) defaultValue = null;

          let extra = "";
          if (/AUTO_INCREMENT/i.test(colDef)) extra = "auto_increment";
          else if (/DEFAULT_GENERATED\s+on\s+update/i.test(colDef)) extra = "DEFAULT_GENERATED on update CURRENT_TIMESTAMP";
          else if (/on\s+update\s+CURRENT_TIMESTAMP/i.test(colDef)) extra = "DEFAULT_GENERATED on update CURRENT_TIMESTAMP";
          else if (/DEFAULT_GENERATED/i.test(colDef)) extra = "DEFAULT_GENERATED";

          let key = "";

          const isTextLike = ["char", "varchar", "text", "tinytext", "mediumtext", "longtext", "enum", "set"].some(t => dataType.startsWith(t));
          const charset = isTextLike ? "utf8mb4" : null;
          const collation = charset ? "utf8mb4_unicode_ci" : null;

          schemaContract[tableName].columns[colName] = {
            ordinal_position: ordinal++,
            data_type: dataType,
            column_type: columnType,
            nullable,
            default: defaultValue,
            key,
            extra,
            charset,
            collation,
          };
        }
      }

      // ─── PRIMARY KEY ──────────────────────────────────────────────────────
      const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(",").map(c => c.replace(/`/g, "").trim());
        schemaContract[tableName].primary_key = cols;
        for (const c of cols) {
          if (schemaContract[tableName].columns[c]) {
            schemaContract[tableName].columns[c].key = "PRI";
          }
        }
      }

      // ─── UNIQUE KEY ───────────────────────────────────────────────────────
      const uqMatch = line.match(/UNIQUE\s+KEY\s+`([^`]+)`\s*\(([^)]+)\)/i);
      if (uqMatch) {
        const idxName = uqMatch[1];
        const cols = uqMatch[2].split(",").map(c => c.replace(/`/g, "").replace(/\(\d+\)/, "").trim());
        schemaContract[tableName].unique_indexes[idxName] = cols;
        for (const c of cols) {
          if (schemaContract[tableName].columns[c] && !schemaContract[tableName].columns[c].key) {
            schemaContract[tableName].columns[c].key = "UNI";
          }
        }
      }

      // ─── NORMAL KEY ───────────────────────────────────────────────────────
      const idxMatch = line.match(/^KEY\s+`([^`]+)`\s*\(([^)]+)\)/i);
      if (idxMatch) {
        const idxName = idxMatch[1];
        const cols = idxMatch[2].split(",").map(c => c.replace(/`/g, "").replace(/\(\d+\)/, "").trim());
        schemaContract[tableName].indexes[idxName] = cols;
        for (const c of cols) {
          if (schemaContract[tableName].columns[c] && !schemaContract[tableName].columns[c].key) {
            schemaContract[tableName].columns[c].key = "MUL";
          }
        }
      }

      // ─── FOREIGN KEY ──────────────────────────────────────────────────────
      const fkMatch = line.match(/CONSTRAINT\s+`([^`]+)`\s+FOREIGN\s+KEY\s*\(`([^`]+)`\)\s+REFERENCES\s+`([^`]+)`\s*\(`([^`]+)`\)/i);
      if (fkMatch) {
        schemaContract[tableName].foreign_keys.push({
          column: fkMatch[2],
          ref_table: fkMatch[3],
          ref_column: fkMatch[4],
          constraint_name: fkMatch[1],
        });
      }
    }
  }

  functionalTables.sort();
  return { schemaContract, functionalTables };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const { schemaContract, functionalTables } = parseCanonical(canonicalSql);

if (functionalTables.length === 0) {
  console.error("[Generate Schema Contract] ❌ CRITICAL: Parser found 0 tables in canonical-schema.sql. Aborting.");
  process.exit(1);
}

// 1. Write schema-contract.json
fs.writeFileSync(contractPath, JSON.stringify(schemaContract, null, 2), "utf8");
console.log(`[Generate Schema Contract] ✅ Wrote schema-contract.json (${functionalTables.length} tables)`);

// 2. Write required-tables.json
fs.writeFileSync(reqTablesPath, JSON.stringify(functionalTables, null, 2), "utf8");
console.log(`[Generate Schema Contract] ✅ Wrote required-tables.json`);

// 3. Write required-columns.json
const reqColsMap = {};
for (const t of functionalTables) {
  reqColsMap[t] = Object.keys(schemaContract[t].columns);
}
fs.writeFileSync(reqColsPath, JSON.stringify(reqColsMap, null, 2), "utf8");
console.log(`[Generate Schema Contract] ✅ Wrote required-columns.json`);

// NOTE: reference-schema.sql is NOT generated here.
// reference-schema.sql must remain the independent local-head snapshot
// captured via mysqldump BEFORE canonical is approved as master.
// Only after LOCAL HEAD == CANONICAL VERIFIED will reference-schema.sql
// be treated as a derived artifact.

console.log(`[Generate Schema Contract] ✅ SUCCESS: Generated contracts for ${functionalTables.length} functional tables from canonical-schema.sql (no live DB required).`);
console.log(`[Generate Schema Contract] ⚠️  reference-schema.sql NOT overwritten — must remain independent until canonical is verified against local head.`);
