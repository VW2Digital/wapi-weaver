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
    if (!migrationAddedCols[t][c].includes(mFile)) {
      migrationAddedCols[t][c].push(mFile);
    }
  }
}

// Scan src/ for SQL files and runtime code
function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "dist") {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const searchDirs = ["src", "scripts", "workers", "services", "integrations"].map(d => path.resolve(rootDir, d));
const allCodeFiles = searchDirs.flatMap(d => getAllFiles(d));

const fileContents = allCodeFiles.map(filePath => ({
  relPath: path.relative(rootDir, filePath).replace(/\\/g, "/"),
  content: fs.readFileSync(filePath, "utf8")
}));

// Find all extra columns missing in contract
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

const audited79Cols = [];

for (const [key, item] of extraColsMap.entries()) {
  const { table, column } = item;
  const reads = [];
  const writes = [];

  const colRegex = new RegExp(`\\b${column}\\b`, 'i');
  const tableRegex = new RegExp(`\\b${table}\\b`, 'i');

  for (const f of fileContents) {
    if (f.content.match(colRegex)) {
      // Check if writing (INSERT / UPDATE)
      if (f.content.match(new RegExp(`(INSERT INTO|UPDATE)\\s+[^;]*${table}`, 'i')) || f.content.match(tableRegex)) {
        if (f.content.match(new RegExp(`INSERT\\s+INTO\\s+${table}[^;]*\\b${column}\\b`, 'i')) ||
            f.content.match(new RegExp(`UPDATE\\s+${table}[^;]*SET[^;]*\\b${column}\\b`, 'i'))) {
          if (!writes.includes(f.relPath)) writes.push(f.relPath);
        } else {
          if (!reads.includes(f.relPath)) reads.push(f.relPath);
        }
      } else {
        if (!reads.includes(f.relPath)) reads.push(f.relPath);
      }
    }
  }

  const migrations = migrationAddedCols[table] && migrationAddedCols[table][column]
    ? migrationAddedCols[table][column]
    : item.source.includes(".sql") ? [item.source] : [];

  const existsInLocalHead = canonicalTables[table] ? canonicalTables[table].has(column) : false;

  const isUsed = reads.length > 0 || writes.length > 0 || migrations.length > 0 || existsInLocalHead;
  const classification = isUsed ? "ACTIVE_REQUIRED" : "LEGACY_UNUSED";

  audited79Cols.push({
    table,
    column,
    runtime_reads: reads,
    runtime_writes: writes,
    created_by_migrations: migrations,
    exists_local_head: existsInLocalHead,
    classification
  });
}

console.log(`Audited ${audited79Cols.length} extra columns.`);

// Also audit for subscription_plans.code and similar obsolete columns
const obsoleteChecks = [
  { table: "subscription_plans", col: "code" },
  { table: "subscription_plans", col: "price_monthly" },
  { table: "subscription_plans", col: "price_yearly" },
  { table: "subscription_plans", col: "max_contacts" },
  { table: "subscription_plans", col: "max_campaigns" },
];

const runtimeDrifts = [];

for (const check of obsoleteChecks) {
  const refs = [];
  const colRegex = new RegExp(`\\b${check.col}\\b`, 'i');
  const tableRegex = new RegExp(`\\b${check.table}\\b`, 'i');

  for (const f of fileContents) {
    if (f.content.match(colRegex) && (f.content.match(tableRegex) || f.content.match(/\b(plan_code|p\.code)\b/i))) {
      refs.push(f.relPath);
    }
  }

  if (refs.length > 0) {
    runtimeDrifts.push({
      table: check.table,
      column: check.col,
      references: refs
    });
  }
}

const auditOutput = {
  total_extra_columns: audited79Cols.length,
  extra_columns: audited79Cols,
  runtime_drifts: runtimeDrifts
};

fs.writeFileSync(path.resolve(rootDir, "database/schema/audited_79_extra_columns.json"), JSON.stringify(auditOutput, null, 2));
console.log("Written audit to database/schema/audited_79_extra_columns.json");
