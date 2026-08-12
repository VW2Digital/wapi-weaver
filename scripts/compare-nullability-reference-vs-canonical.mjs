import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const refSqlPath = path.resolve(rootDir, "database/schema/reference-schema.sql");
const canSqlPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");

const refSql = fs.readFileSync(refSqlPath, "utf8");
const canSql = fs.readFileSync(canSqlPath, "utf8");

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
        tables[tableName].columns[colName] = { nullable, colDef, colType };
      }
    }
  }
  return tables;
}

const refTables = parseSqlTables(refSql);
const canTables = parseSqlTables(canSql);

const nullabilityMismatches = [];
const pkMismatches = [];

for (const [tableName, canSpec] of Object.entries(canTables)) {
  const refSpec = refTables[tableName];
  if (!refSpec) continue;

  for (const [colName, canCol] of Object.entries(canSpec.columns)) {
    const refCol = refSpec.columns[colName];
    if (refCol) {
      const expectedNullable = canCol.nullable; // false = NOT NULL
      const actualNullable = refCol.nullable;   // true = NULL in DB

      if (expectedNullable === false && actualNullable === true) {
        nullabilityMismatches.push({
          table: tableName,
          column: colName,
          colType: refCol.colType,
          colDef: refCol.colDef,
          canDef: canCol.colDef,
          expected: "NOT NULL",
          actual: "NULL",
        });
      }
    }
  }

  const canPk = canSpec.pk.join(",");
  const refPk = refSpec.pk.join(",");
  if (canPk !== refPk) {
    pkMismatches.push({
      table: tableName,
      canPk,
      refPk,
    });
  }
}

const scratchDir = path.resolve(rootDir, "scratch");
if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

fs.writeFileSync(
  path.resolve(scratchDir, "nullability_comparison_full.json"),
  JSON.stringify({ totalMismatches: nullabilityMismatches.length, nullabilityMismatches, pkMismatches }, null, 2)
);

console.log(`✅ Analyzed Schema Nullabilities: Total Mismatches = ${nullabilityMismatches.length}, PK Mismatches = ${pkMismatches.length}`);
