import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");
const referencePath = path.resolve(rootDir, "database/schema/reference-schema.sql");
const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");

const schemaContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const refSql = fs.readFileSync(referencePath, "utf8");

// Parse reference-schema.sql for physical IS_NULLABLE state
function parseSqlTableCols(sql) {
  const tables = {};
  const tableMatches = [...sql.matchAll(/CREATE\s+TABLE\s+`([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi)];

  for (const match of tableMatches) {
    const tableName = match[1];
    const body = match[2];
    tables[tableName] = {};

    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("PRIMARY KEY") || line.startsWith("UNIQUE KEY") || line.startsWith("KEY ") || line.startsWith("CONSTRAINT")) {
        continue;
      }
      const colMatch = line.match(/^`([a-zA-Z0-9_]+)`\s+(.+?)(?:,)?$/);
      if (colMatch) {
        const colName = colMatch[1];
        const colDef = colMatch[2];
        const nullable = !/NOT\s+NULL/i.test(colDef);
        const colTypeMatch = colDef.match(/^([a-zA-Z0-9_\(\),]+)/i);
        const colType = colTypeMatch ? colTypeMatch[1] : colDef.split(" ")[0];
        tables[tableName][colName] = { nullable, colDef, colType };
      }
    }
  }
  return tables;
}

const refTables = parseSqlTableCols(refSql);

const nullabilityMismatches = [];

for (const [table, spec] of Object.entries(schemaContract)) {
  const refCols = refTables[table];
  if (!refCols) continue;

  for (const [colName, colSpec] of Object.entries(spec.columns)) {
    const refCol = refCols[colName];
    if (refCol) {
      const expectedNullable = colSpec.nullable;
      const actualNullable = refCol.nullable;
      if (expectedNullable !== actualNullable) {
        nullabilityMismatches.push({
          table,
          column: colName,
          expectedNullable,
          actualNullable,
          colType: refCol.colType,
          colDef: refCol.colDef,
        });
      }
    }
  }
}

console.log(`TOTAL NULLABILITY MISMATCHES BETWEEN CONTRACT AND REFERENCE SCHEMA: ${nullabilityMismatches.length}`);
fs.writeFileSync(
  path.resolve(rootDir, "scratch/nullability_diff_list.json"),
  JSON.stringify(nullabilityMismatches, null, 2)
);
