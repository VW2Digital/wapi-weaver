/**
 * sync-schema.js — Safe, additive schema reconciliation
 *
 * Compares reference-schema.sql (DDL snapshot from local MySQL) against the live database
 * (INFORMATION_SCHEMA) and automatically applies SAFE, NON-DESTRUCTIVE changes:
 *
 *   AUTO-APPLY:
 *     - Missing tables → CREATE TABLE
 *     - Missing columns → ALTER TABLE ADD COLUMN
 *     - Missing indexes (non-unique) → CREATE INDEX
 *     - Missing unique indexes (if no duplicate data) → CREATE UNIQUE INDEX
 *     - Missing foreign keys (if data integrity satisfied) → ADD CONSTRAINT
 *
 *   NEVER AUTO-APPLY:
 *     - DROP TABLE / DROP COLUMN
 *     - RENAME TABLE / RENAME COLUMN
 *     - Type changes that shrink/break data
 *     - NULL→NOT NULL when NULLs exist
 *     - DELETE / TRUNCATE
 *
 * Usage:
 *   node scripts/sync-schema.js              — apply changes
 *   node scripts/sync-schema.js --dry-run    — report only, no changes
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_MANUAL = process.argv.includes("--allow-manual");

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------
const dotenvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  for (const line of fs.readFileSync(dotenvPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const [k, ...rest] = t.split("=");
      const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[k.trim()]) process.env[k.trim()] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function log(msg) { console.log(`[Schema-Sync] ${msg}`); }
function warn(msg) { console.warn(`[Schema-Sync] ⚠  ${msg}`); }
function ok(msg) { console.log(`[Schema-Sync] ✅ ${msg}`); }
function info(msg) { console.log(`[Schema-Sync]    ${msg}`); }

// ---------------------------------------------------------------------------
// Canonical SQL parser — minimal, focused on extracting CREATE TABLE blocks
// ---------------------------------------------------------------------------
function parseCanonicalTables(sql) {
  /**
   * Returns Map<tableName, { createSql, columns, indexes, foreignKeys }>
   * We parse just enough to drive safe reconciliation.
   */
  const tables = new Map();

  // Match each CREATE TABLE ... ENGINE= block
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE\s*=/gi;
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];

    // Skip schema_migrations — managed by create-all-tables.js
    if (tableName === "schema_migrations") continue;

    const columns = [];
    const indexes = [];
    const foreignKeys = [];

    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Column line (not a constraint keyword)
      if (/^`[a-zA-Z0-9_]+`/.test(line)) {
        const colNameMatch = line.match(/^`([a-zA-Z0-9_]+)`\s+(.+?)(?:,\s*)?$/);
        if (colNameMatch) {
          columns.push({
            name: colNameMatch[1],
            definition: colNameMatch[2].replace(/,$/, "").trim(),
          });
        }
      }

      // PRIMARY KEY
      else if (/^PRIMARY\s+KEY/i.test(line)) {
        // included for context but we don't auto-recreate PKs
      }

      // UNIQUE KEY / UNIQUE INDEX
      else if (/^UNIQUE\s+(?:KEY|INDEX)\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)/i.test(line)) {
        const m = line.match(/^UNIQUE\s+(?:KEY|INDEX)\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)/i);
        if (m) {
          indexes.push({ name: m[1], columns: m[2], unique: true });
        }
      }

      // KEY / INDEX (non-unique)
      else if (/^KEY\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)/i.test(line)) {
        const m = line.match(/^KEY\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)/i);
        if (m) {
          indexes.push({ name: m[1], columns: m[2], unique: false });
        }
      }

      // CONSTRAINT (foreign key)
      else if (/^CONSTRAINT\s+`([a-zA-Z0-9_]+)`\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)(.*)?/i.test(line)) {
        const m = line.match(/^CONSTRAINT\s+`([a-zA-Z0-9_]+)`\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`([a-zA-Z0-9_]+)`\s*\(([^)]+)\)(.*)?/i);
        if (m) {
          foreignKeys.push({
            name: m[1],
            column: m[2].replace(/`/g, "").trim(),
            refTable: m[3],
            refColumn: m[4].replace(/`/g, "").trim(),
            actions: (m[5] || "").trim(),
          });
        }
      }
    }

    // Full CREATE TABLE SQL for this table (needed if table is missing entirely)
    const startIdx = sql.indexOf(match[0]);
    const endIdx = startIdx + match[0].length;
    // Find the closing ENGINE=... line
    const engineLineEnd = sql.indexOf(";", endIdx);
    const fullCreate = sql.slice(startIdx, engineLineEnd + 1);

    tables.set(tableName, { columns, indexes, foreignKeys, createSql: fullCreate });
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Live schema readers
// ---------------------------------------------------------------------------
async function getLiveTables(conn) {
  const [rows] = await conn.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
  );
  return new Set(rows.map(r => r.TABLE_NAME));
}

async function getLiveColumns(conn, tableName) {
  const [rows] = await conn.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
    [tableName]
  );
  return new Set(rows.map(r => r.COLUMN_NAME));
}

async function getLiveIndexes(conn, tableName) {
  const [rows] = await conn.query(
    "SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? GROUP BY INDEX_NAME, NON_UNIQUE",
    [tableName]
  );
  return new Map(rows.map(r => [r.INDEX_NAME, { unique: r.NON_UNIQUE === 0 }]));
}

async function getLiveFKs(conn, tableName) {
  const [rows] = await conn.query(
    "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
    [tableName]
  );
  return new Map(rows.map(r => [r.CONSTRAINT_NAME, { column: r.COLUMN_NAME, refTable: r.REFERENCED_TABLE_NAME, refColumn: r.REFERENCED_COLUMN_NAME }]));
}

async function countDuplicates(conn, tableName, columns) {
  const colList = columns.split(",").map(c => c.trim()).join(", ");
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS dup FROM (SELECT ${colList} FROM \`${tableName}\` GROUP BY ${colList} HAVING COUNT(*) > 1) d`
  );
  return Number(rows[0]?.dup ?? 0);
}

async function countOrphans(conn, childTable, childCol, refTable, refCol) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS orphans FROM \`${childTable}\` c LEFT JOIN \`${refTable}\` r ON r.\`${refCol}\` = c.\`${childCol}\` WHERE r.\`${refCol}\` IS NULL AND c.\`${childCol}\` IS NOT NULL`
  );
  return Number(rows[0]?.orphans ?? 0);
}

// ---------------------------------------------------------------------------
// Main reconciliation
// ---------------------------------------------------------------------------
async function syncSchema() {
  const canonicalPath = path.resolve(__dirname, "../database/schema/reference-schema.sql");
  if (!fs.existsSync(canonicalPath)) {
    console.error("[Schema-Sync] ❌ reference-schema.sql not found");
    process.exit(1);
  }

  const canonicalSql = fs.readFileSync(canonicalPath, "utf8");
  const canonicalTables = parseCanonicalTables(canonicalSql);

  log(`Local reference source: database/schema/reference-schema.sql (${canonicalTables.size} tables)`);
  if (DRY_RUN) log("DRY-RUN mode — no changes will be applied");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[Schema-Sync] ❌ DB_PASSWORD environment variable is missing");
    process.exit(1);
  }

  let conn;
  let attempts = 0;
  while (attempts < 15) {
    try {
      conn = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER || "wapi_user",
        password: dbPassword,
        database: process.env.DB_NAME || "wapi_weaver",
        multipleStatements: false,
      });
      break;
    } catch (err) {
      attempts++;
      log(`Waiting for MySQL (${attempts}/15)... ${err.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!conn) {
    console.error("[Schema-Sync] ❌ Could not connect to MySQL after 15 attempts");
    process.exit(1);
  }

  let applied = 0;
  let skipped = 0;
  const manualRequired = [];

  try {
    const liveTables = await getLiveTables(conn);

    for (const [tableName, def] of canonicalTables) {
      // ─── TABLE MISSING ────────────────────────────────────────────────────
      if (!liveTables.has(tableName)) {
        info(`Missing table: \`${tableName}\` → CREATE TABLE`);
        if (!DRY_RUN) {
          try {
            // Use IF NOT EXISTS from canonical CREATE (already there)
            await conn.query(def.createSql);
            ok(`Table \`${tableName}\` created.`);
            applied++;
          } catch (err) {
            warn(`Failed to create \`${tableName}\`: ${err.message}`);
            manualRequired.push(`CREATE TABLE \`${tableName}\` failed: ${err.message}`);
          }
        } else {
          info(`[DRY-RUN] Would create table \`${tableName}\``);
          applied++;
        }
        continue; // All columns/indexes will be created with the table
      }

      // ─── COLUMNS ─────────────────────────────────────────────────────────
      const liveColumns = await getLiveColumns(conn, tableName);
      for (const col of def.columns) {
        if (!liveColumns.has(col.name)) {
          info(`Missing column: \`${tableName}\`.\`${col.name}\` → ADD COLUMN`);
          if (!DRY_RUN) {
            try {
              await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.name}\` ${col.definition}`);
              ok(`Column \`${tableName}\`.\`${col.name}\` added.`);
              applied++;
            } catch (err) {
              if (err.code === "ER_DUP_FIELDNAME") {
                skipped++;
              } else {
                warn(`Failed to add \`${tableName}\`.\`${col.name}\`: ${err.message}`);
                manualRequired.push(`ADD COLUMN \`${tableName}\`.\`${col.name}\`: ${err.message}`);
              }
            }
          } else {
            info(`[DRY-RUN] Would add column \`${tableName}\`.\`${col.name}\``);
            applied++;
          }
        } else {
          skipped++;
        }
      }

      // ─── INDEXES ─────────────────────────────────────────────────────────
      const liveIndexes = await getLiveIndexes(conn, tableName);
      for (const idx of def.indexes) {
        if (liveIndexes.has(idx.name)) { skipped++; continue; }
        if (idx.name === "PRIMARY") { skipped++; continue; }

        if (idx.unique) {
          // Pre-check: any duplicates?
          let dups = 0;
          try {
            dups = await countDuplicates(conn, tableName, idx.columns);
          } catch (_) { /* if check fails, skip */ }
          if (dups > 0) {
            warn(`Cannot add UNIQUE INDEX \`${idx.name}\` on \`${tableName}\` — ${dups} duplicate row(s) exist.`);
            manualRequired.push(`UNIQUE INDEX \`${tableName}\`.\`${idx.name}\` blocked by ${dups} duplicates — manual migration required`);
            continue;
          }
        }

        info(`Missing ${idx.unique ? "UNIQUE " : ""}INDEX \`${idx.name}\` on \`${tableName}\``);
        if (!DRY_RUN) {
          try {
            const unique = idx.unique ? "UNIQUE" : "";
            await conn.query(`CREATE ${unique} INDEX \`${idx.name}\` ON \`${tableName}\` (${idx.columns})`);
            ok(`Index \`${idx.name}\` on \`${tableName}\` created.`);
            applied++;
          } catch (err) {
            if (err.code === "ER_DUP_KEYNAME") { skipped++; }
            else {
              warn(`Failed to add index \`${idx.name}\` on \`${tableName}\`: ${err.message}`);
              manualRequired.push(`INDEX \`${tableName}\`.\`${idx.name}\`: ${err.message}`);
            }
          }
        } else {
          info(`[DRY-RUN] Would add index \`${idx.name}\` on \`${tableName}\``);
          applied++;
        }
      }

      // ─── FOREIGN KEYS ────────────────────────────────────────────────────
      const liveFKs = await getLiveFKs(conn, tableName);
      for (const fk of def.foreignKeys) {
        if (liveFKs.has(fk.name)) { skipped++; continue; }

        // Pre-check: ref table + column must exist
        if (!liveTables.has(fk.refTable)) {
          warn(`FK \`${fk.name}\` on \`${tableName}\` blocked — referenced table \`${fk.refTable}\` does not exist.`);
          manualRequired.push(`FK \`${fk.name}\` on \`${tableName}\`: ref table \`${fk.refTable}\` missing`);
          continue;
        }

        // Pre-check: orphan rows
        let orphans = 0;
        try {
          orphans = await countOrphans(conn, tableName, fk.column, fk.refTable, fk.refColumn);
        } catch (_) { /* if check fails, skip */ }
        if (orphans > 0) {
          warn(`FK \`${fk.name}\` on \`${tableName}\` blocked — ${orphans} orphan row(s) in \`${fk.column}\`.`);
          manualRequired.push(`FK \`${fk.name}\` on \`${tableName}\`: ${orphans} orphan rows — manual cleanup required`);
          continue;
        }

        info(`Missing FK \`${fk.name}\` on \`${tableName}\`(\`${fk.column}\`) → \`${fk.refTable}\`(\`${fk.refColumn}\`)`);
        if (!DRY_RUN) {
          try {
            const actionsSql = fk.actions ? ` ${fk.actions}` : "";
            await conn.query(
              `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\` (\`${fk.refColumn}\`)${actionsSql}`
            );
            ok(`FK \`${fk.name}\` on \`${tableName}\` added.`);
            applied++;
          } catch (err) {
            if (err.code === "ER_DUP_KEYNAME" || err.errno === 1826) { skipped++; }
            else {
              warn(`Failed to add FK \`${fk.name}\` on \`${tableName}\`: ${err.message}`);
              manualRequired.push(`FK \`${fk.name}\` on \`${tableName}\`: ${err.message}`);
            }
          }
        } else {
          info(`[DRY-RUN] Would add FK \`${fk.name}\` on \`${tableName}\``);
          applied++;
        }
      }
    }

  } finally {
    await conn.end();
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("");
  console.log("=========================================================");
  console.log("  SCHEMA SYNC SUMMARY");
  console.log("=========================================================");
  if (DRY_RUN) {
    console.log(`  DRY-RUN: ${applied} change(s) would be applied`);
  } else {
    console.log(`  Applied:  ${applied} change(s)`);
  }
  console.log(`  Up-to-date: ${skipped} item(s) already correct`);
  if (manualRequired.length > 0) {
    console.log(`  Manual migration required (${manualRequired.length}):`);
    manualRequired.forEach(m => console.log(`    - ${m}`));
    if (ALLOW_MANUAL) {
      console.log("  Startup mode: preserving affected rows and continuing with warnings.");
    }
  } else {
    console.log("  Manual migration required: 0");
  }
  console.log("=========================================================");
  console.log("");

  if (manualRequired.length > 0 && !ALLOW_MANUAL) {
    process.exit(2); // exit code 2 = completed but manual action needed
  }
  process.exit(0);
}

syncSchema().catch(err => {
  console.error("[Schema-Sync] ❌ Unexpected error:", err.message);
  process.exit(1);
});
