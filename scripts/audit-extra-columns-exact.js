import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");
const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
const migrationsDir = path.resolve(rootDir, "database/migrations");

const schemaContract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const canonicalSql = fs.readFileSync(canonicalPath, "utf8");

// Parse CREATE TABLE blocks in canonical-schema.sql
const tableBlocks = canonicalSql.split(/CREATE TABLE (?:IF NOT EXISTS )?`/i);
const canonicalTables = {};

for (const block of tableBlocks) {
  if (!block.trim()) continue;
  const tableNameMatch = block.match(/^([a-zA-Z0-9_]+)`/);
  if (!tableNameMatch) continue;
  const tableName = tableNameMatch[1];
  canonicalTables[tableName] = new Set();

  const lines = block.split("\n");
  for (const line of lines) {
    const colMatch = line.trim().match(/^`([a-zA-Z0-9_]+)`\s+/);
    if (colMatch) {
      canonicalTables[tableName].add(colMatch[1]);
    }
  }
}

// Read migrations for added columns
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const migrationAddedCols = {};

for (const mFile of migrationFiles) {
  const content = fs.readFileSync(path.resolve(migrationsDir, mFile), "utf8");
  const addMatches = content.matchAll(/ALTER TABLE [`']?([a-zA-Z0-9_]+)[`']?\s+ADD COLUMN [`']?([a-zA-Z0-9_]+)[`']?/gi);
  for (const match of addMatches) {
    const t = match[1];
    const c = match[2];
    if (!migrationAddedCols[t]) migrationAddedCols[t] = {};
    if (!migrationAddedCols[t][c]) migrationAddedCols[t][c] = [];
    migrationAddedCols[t][c].push(mFile);
  }
}

// Find all extra columns present in canonical or migrations but missing in schema-contract.json
const extraColsMap = new Map();

for (const t of Object.keys(schemaContract)) {
  const contractCols = schemaContract[t].columns || {};

  // Check canonical columns
  const canonCols = canonicalTables[t] || new Set();
  for (const col of canonCols) {
    if (!contractCols[col]) {
      const key = `${t}.${col}`;
      if (!extraColsMap.has(key)) {
        extraColsMap.set(key, { table: t, column: col, source: "canonical-schema.sql" });
      }
    }
  }

  // Check migration added columns
  if (migrationAddedCols[t]) {
    for (const col of Object.keys(migrationAddedCols[t])) {
      if (!contractCols[col] && !canonCols.has(col)) {
        const key = `${t}.${col}`;
        if (!extraColsMap.has(key)) {
          extraColsMap.set(key, { table: t, column: col, source: migrationAddedCols[t][col].join(", ") });
        }
      }
    }
  }
}

console.log(`Total Extra Columns found: ${extraColsMap.size}`);
const result = Array.from(extraColsMap.values());
fs.writeFileSync(path.resolve(rootDir, "scratch/extra_cols_audit.json"), JSON.stringify(result, null, 2));
