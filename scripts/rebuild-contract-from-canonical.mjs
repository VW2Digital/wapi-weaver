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

const canonicalSql = fs.readFileSync(canonicalPath, "utf8");

// Split by CREATE TABLE
const rawBlocks = canonicalSql.split(/CREATE TABLE (?:IF NOT EXISTS )?`/i);
const schemaContract = {};
const functionalTables = [];

for (const block of rawBlocks) {
  if (!block.trim()) continue;
  const nameMatch = block.match(/^([a-zA-Z0-9_]+)`/);
  if (!nameMatch) continue;

  const tableName = nameMatch[1];
  if (tableName === "schema_migrations") continue;

  functionalTables.push(tableName);
  schemaContract[tableName] = {
    columns: {},
    primary_key: [],
    unique_indexes: {},
    indexes: {},
    foreign_keys: [],
  };

  const lines = block.split("\n");
  let ordinal = 1;

  for (const line of lines) {
    const trimmed = line.trim();

    // 1. Column definition
    const colMatch = trimmed.match(/^`([a-zA-Z0-9_]+)`\s+([a-zA-Z0-9_\(\),]+)(?:\s+COLLATE\s+([a-zA-Z0-9_]+))?(?:\s+(NOT NULL|NULL))?(?:\s+DEFAULT\s+('([^']*)'|CURRENT_TIMESTAMP|NULL|(\d+)))?(?:\s+(AUTO_INCREMENT|DEFAULT_GENERATED|on update CURRENT_TIMESTAMP|DEFAULT_GENERATED on update CURRENT_TIMESTAMP))?/i);

    if (colMatch && !trimmed.startsWith("PRIMARY KEY") && !trimmed.startsWith("KEY") && !trimmed.startsWith("UNIQUE KEY") && !trimmed.startsWith("CONSTRAINT")) {
      const colName = colMatch[1];
      const columnType = colMatch[2].toLowerCase();
      const dataType = columnType.split("(")[0];
      const nullable = !trimmed.includes("NOT NULL");

      let defaultValue = null;
      if (trimmed.includes("DEFAULT NULL")) {
        defaultValue = null;
      } else if (trimmed.includes("DEFAULT CURRENT_TIMESTAMP")) {
        defaultValue = "CURRENT_TIMESTAMP";
      } else if (trimmed.includes("DEFAULT ")) {
        const defMatch = trimmed.match(/DEFAULT\s+('([^']*)'|(\d+)|([A-Za-z0-9_]+))/i);
        if (defMatch) {
          defaultValue = defMatch[2] !== undefined ? defMatch[2] : (defMatch[3] !== undefined ? defMatch[3] : defMatch[4]);
        }
      }

      let extra = "";
      if (trimmed.includes("AUTO_INCREMENT")) {
        extra = "auto_increment";
      } else if (trimmed.includes("DEFAULT_GENERATED on update CURRENT_TIMESTAMP")) {
        extra = "DEFAULT_GENERATED on update CURRENT_TIMESTAMP";
      } else if (trimmed.includes("on update CURRENT_TIMESTAMP")) {
        extra = "DEFAULT_GENERATED on update CURRENT_TIMESTAMP";
      } else if (trimmed.includes("DEFAULT_GENERATED")) {
        extra = "DEFAULT_GENERATED";
      }

      let key = "";
      if (trimmed.includes("PRIMARY KEY")) key = "PRI";

      let charset = dataType.includes("char") || dataType.includes("text") || dataType.includes("enum") ? "utf8mb4" : null;
      let collation = charset ? "utf8mb4_unicode_ci" : null;

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

    // 2. Primary key definition
    const pkMatch = trimmed.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      const cols = pkMatch[1].split(",").map(c => c.replace(/`/g, "").trim());
      schemaContract[tableName].primary_key = cols;
      for (const c of cols) {
        if (schemaContract[tableName].columns[c]) {
          schemaContract[tableName].columns[c].key = "PRI";
        }
      }
    }

    // 3. Unique index definition
    const uqMatch = trimmed.match(/UNIQUE KEY\s+`([^`]+)`\s*\(([^)]+)\)/i);
    if (uqMatch) {
      const idxName = uqMatch[1];
      const cols = uqMatch[2].split(",").map(c => c.replace(/`/g, "").trim());
      schemaContract[tableName].unique_indexes[idxName] = cols;
      for (const c of cols) {
        if (schemaContract[tableName].columns[c] && !schemaContract[tableName].columns[c].key) {
          schemaContract[tableName].columns[c].key = "UNI";
        }
      }
    }

    // 4. Normal index definition
    const idxMatch = trimmed.match(/KEY\s+`([^`]+)`\s*\(([^)]+)\)/i);
    if (idxMatch && !trimmed.startsWith("UNIQUE KEY") && !trimmed.startsWith("CONSTRAINT")) {
      const idxName = idxMatch[1];
      const cols = idxMatch[2].split(",").map(c => c.replace(/`/g, "").trim());
      schemaContract[tableName].indexes[idxName] = cols;
      for (const c of cols) {
        if (schemaContract[tableName].columns[c] && !schemaContract[tableName].columns[c].key) {
          schemaContract[tableName].columns[c].key = "MUL";
        }
      }
    }

    // 5. Foreign key definition
    const fkMatch = trimmed.match(/CONSTRAINT\s+`([^`]+)`\s+FOREIGN KEY\s*\(`([^`]+)`\)\s+REFERENCES\s+`([^`]+)`\s*\(`([^`]+)`\)/i);
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

// 1. Write schema-contract.json
fs.writeFileSync(contractPath, JSON.stringify(schemaContract, null, 2), "utf8");

// 2. Write required-tables.json
fs.writeFileSync(reqTablesPath, JSON.stringify(functionalTables, null, 2), "utf8");

// 3. Write required-columns.json
const reqColsMap = {};
for (const t of functionalTables) {
  reqColsMap[t] = Object.keys(schemaContract[t].columns);
}
fs.writeFileSync(reqColsPath, JSON.stringify(reqColsMap, null, 2), "utf8");

// 4. Write reference-schema.sql
const refSql = canonicalSql.replace(/CREATE TABLE IF NOT EXISTS/g, "CREATE TABLE");
fs.writeFileSync(referencePath, refSql, "utf8");

console.log(`Rebuilt all contract files for ${functionalTables.length} functional tables from canonical-schema.sql.`);
