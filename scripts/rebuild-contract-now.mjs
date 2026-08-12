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

const canonicalSql = fs.readFileSync(canonicalPath, "utf8");

function parseCanonical(sql) {
  const schemaContract = {};
  const functionalTables = [];

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
      const isConstraintLine =
        line.startsWith("PRIMARY KEY") ||
        line.startsWith("UNIQUE KEY") ||
        line.startsWith("KEY ") ||
        line.startsWith("CONSTRAINT") ||
        line.startsWith("INDEX ");

      if (!isConstraintLine) {
        const colMatch = line.match(/^`([a-zA-Z0-9_]+)`\s+(.+?)(?:,)?$/);
        if (colMatch) {
          const colName = colMatch[1];
          const colDef = colMatch[2];

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

const { schemaContract, functionalTables } = parseCanonical(canonicalSql);

fs.writeFileSync(contractPath, JSON.stringify(schemaContract, null, 2), "utf8");
fs.writeFileSync(reqTablesPath, JSON.stringify(functionalTables, null, 2), "utf8");

const reqColsMap = {};
for (const t of functionalTables) {
  reqColsMap[t] = Object.keys(schemaContract[t].columns);
}
fs.writeFileSync(reqColsPath, JSON.stringify(reqColsMap, null, 2), "utf8");

console.log(`✅ Regenerated contracts for ${functionalTables.length} tables from canonical-schema.sql.`);
