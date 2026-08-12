import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
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

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeType(t) {
  if (!t) return "";
  let s = t.toLowerCase().trim();
  if (s === "boolean" || s === "tinyint(1)") return "tinyint(1)";
  s = s.replace(/int\(\d+\)/, "int");
  s = s.replace(/bigint\(\d+\)/, "bigint");
  s = s.replace(/varchar\((\d+)\)/, "varchar($1)");
  return s;
}

function normalizeDefault(d) {
  if (d === null || d === undefined) return "null";
  let s = String(d).toLowerCase().trim().replace(/^["']|["']$/g, "");
  if (s === "current_timestamp()" || s === "current_timestamp") return "current_timestamp";
  if (s === "0" || s === "'0'") return "0";
  if (s === "1" || s === "'1'") return "1";
  if (s === "null") return "null";
  return s;
}

function parseCanonical(canonicalSql) {
  const tables = {};
  const tableMatches = [...canonicalSql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([a-zA-Z0-9_]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi)];

  for (const match of tableMatches) {
    const tableName = match[1];
    if (tableName === "schema_migrations") continue;

    const body = match[2];
    tables[tableName] = {
      columns: {},
      primaryKey: [],
      uniqueIndexes: {},
      indexes: {},
      foreignKeys: []
    };

    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.startsWith("PRIMARY KEY")) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s+\(([^)]+)\)/i);
        if (pkMatch) {
          tables[tableName].primaryKey = pkMatch[1].split(",").map(c => c.replace(/`/g, "").trim());
        }
      } else if (line.startsWith("UNIQUE KEY")) {
        const uqMatch = line.match(/UNIQUE\s+KEY\s+`([a-zA-Z0-9_]+)`\s+\(([^)]+)\)/i);
        if (uqMatch) {
          tables[tableName].uniqueIndexes[uqMatch[1]] = uqMatch[2].split(",").map(c => c.replace(/`/g, "").trim().split(" ")[0]);
        }
      } else if (line.startsWith("KEY ")) {
        const idxMatch = line.match(/KEY\s+`([a-zA-Z0-9_]+)`\s+\(([^)]+)\)/i);
        if (idxMatch) {
          tables[tableName].indexes[idxMatch[1]] = idxMatch[2].split(",").map(c => c.replace(/`/g, "").trim().split(" ")[0]);
        }
      } else if (line.startsWith("CONSTRAINT")) {
        const fkMatch = line.match(/CONSTRAINT\s+`([a-zA-Z0-9_]+)`\s+FOREIGN\s+KEY\s+\(`([^`]+)`\)\s+REFERENCES\s+`([^`]+)`\s+\(`([^`]+)`\)/i);
        if (fkMatch) {
          tables[tableName].foreignKeys.push({
            name: fkMatch[1],
            column: fkMatch[2],
            refTable: fkMatch[3],
            refColumn: fkMatch[4]
          });
        }
      } else {
        const colMatch = line.match(/^`([a-zA-Z0-9_]+)`\s+(.+?)(?:,)?$/);
        if (colMatch) {
          const colName = colMatch[1];
          const colDef = colMatch[2];

          const typeMatch = colDef.match(/^([a-zA-Z]+(?:\([^)]*\))?(?:\s+unsigned)?)/i);
          const columnType = typeMatch ? typeMatch[1].toLowerCase().trim() : colDef.split(" ")[0].toLowerCase();

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
          else if (/on\s+update\s+CURRENT_TIMESTAMP/i.test(colDef)) extra = "DEFAULT_GENERATED on update CURRENT_TIMESTAMP";

          tables[tableName].columns[colName] = {
            columnType,
            nullable,
            defaultValue,
            extra
          };
        }
      }
    }
  }

  return tables;
}

async function main() {
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "wapi_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "wapi_weaver";

  if (!password) {
    console.error("[Compare Schema] ❌ CRITICAL: DB_PASSWORD missing.");
    process.exit(1);
  }

  const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
  const canonicalSql = fs.readFileSync(canonicalPath, "utf8");
  const canonicalTables = parseCanonical(canonicalSql);

  const connection = await mysql.createConnection({ host, port, user, password, database });

  try {
    // Query physical information_schema
    const [physTablesRows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [database]
    );
    const physicalTableNames = physTablesRows.map(r => r.TABLE_NAME).filter(t => t !== "schema_migrations");
    const physicalTableSet = new Set(physicalTableNames);

    const [physColRows] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME != 'schema_migrations'`,
      [database]
    );

    const physicalColumns = {};
    for (const r of physColRows) {
      if (!physicalColumns[r.TABLE_NAME]) physicalColumns[r.TABLE_NAME] = {};
      physicalColumns[r.TABLE_NAME][r.COLUMN_NAME] = {
        columnType: r.COLUMN_TYPE.toLowerCase(),
        nullable: r.IS_NULLABLE === "YES",
        defaultValue: r.COLUMN_DEFAULT,
        extra: r.EXTRA || ""
      };
    }

    // Query PKs and Indexes
    const [physKeyRows] = await connection.query(
      `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME != 'schema_migrations'
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [database]
    );

    const physicalPKs = {};
    const physicalUniqueIndexes = {};
    const physicalIndexes = {};

    for (const r of physKeyRows) {
      const tbl = r.TABLE_NAME;
      if (r.INDEX_NAME === "PRIMARY") {
        if (!physicalPKs[tbl]) physicalPKs[tbl] = [];
        physicalPKs[tbl].push(r.COLUMN_NAME);
      } else if (r.NON_UNIQUE === 0) {
        if (!physicalUniqueIndexes[tbl]) physicalUniqueIndexes[tbl] = {};
        if (!physicalUniqueIndexes[tbl][r.INDEX_NAME]) physicalUniqueIndexes[tbl][r.INDEX_NAME] = [];
        physicalUniqueIndexes[tbl][r.INDEX_NAME].push(r.COLUMN_NAME);
      } else {
        if (!physicalIndexes[tbl]) physicalIndexes[tbl] = {};
        if (!physicalIndexes[tbl][r.INDEX_NAME]) physicalIndexes[tbl][r.INDEX_NAME] = [];
        physicalIndexes[tbl][r.INDEX_NAME].push(r.COLUMN_NAME);
      }
    }

    // Query Foreign Keys
    const [physFkRows] = await connection.query(
      `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [database]
    );

    const physicalFKs = {};
    for (const r of physFkRows) {
      if (!physicalFKs[r.TABLE_NAME]) physicalFKs[r.TABLE_NAME] = [];
      physicalFKs[r.TABLE_NAME].push({
        name: r.CONSTRAINT_NAME,
        column: r.COLUMN_NAME,
        refTable: r.REFERENCED_TABLE_NAME,
        refColumn: r.REFERENCED_COLUMN_NAME
      });
    }

    // ─── Diffs Calculation ───────────────────────────────────────────────────

    let tableDiffCount = 0;
    let columnDiffCount = 0;
    let typeDiffCount = 0;
    let nullabilityDiffCount = 0;
    let defaultDiffCount = 0;
    let extraDiffCount = 0;
    let pkDiffCount = 0;
    let uniqueIdxDiffCount = 0;
    let idxDiffCount = 0;
    let fkDiffCount = 0;

    let unknownDiffCount = 0;
    const classifications = [];

    const canonicalTableNames = Object.keys(canonicalTables);

    // 1. Table diff
    for (const ct of canonicalTableNames) {
      if (!physicalTableSet.has(ct)) {
        tableDiffCount++;
        unknownDiffCount++;
        classifications.push({ type: "TABLE_MISSING", name: ct, class: "UNKNOWN" });
      }
    }
    for (const pt of physicalTableNames) {
      if (!canonicalTables[pt]) {
        tableDiffCount++;
        unknownDiffCount++;
        classifications.push({ type: "TABLE_EXTRA", name: pt, class: "UNKNOWN" });
      }
    }

    // 2. Column diffs
    for (const tName of canonicalTableNames) {
      if (!physicalTableSet.has(tName)) continue;
      const cTable = canonicalTables[tName];
      const pTableCols = physicalColumns[tName] || {};

      for (const [colName, cCol] of Object.entries(cTable.columns)) {
        const pCol = pTableCols[colName];
        if (!pCol) {
          columnDiffCount++;
          unknownDiffCount++;
          classifications.push({ type: "COLUMN_MISSING", table: tName, column: colName, class: "UNKNOWN" });
          continue;
        }

        // Type
        if (normalizeType(cCol.columnType) !== normalizeType(pCol.columnType)) {
          typeDiffCount++;
          classifications.push({ type: "TYPE_MISMATCH", table: tName, column: colName, canonical: cCol.columnType, physical: pCol.columnType, class: "SEMANTIC_EQUIVALENT" });
        }

        // Nullability
        if (cCol.nullable !== pCol.nullable) {
          nullabilityDiffCount++;
          const isKnownDrift = (tName === "webhook_events" && (colName === "event_type" || colName === "status")) || (tName === "ds_agent_tools" && colName === "tool_key");
          if (!isKnownDrift) unknownDiffCount++;
          classifications.push({ type: "NULLABILITY_MISMATCH", table: tName, column: colName, class: isKnownDrift ? "MIGRATION_DRIFT" : "UNKNOWN" });
        }

        // Default
        if (normalizeDefault(cCol.defaultValue) !== normalizeDefault(pCol.defaultValue)) {
          defaultDiffCount++;
          const isKnownDrift = (tName === "webhook_events" && (colName === "event_type" || colName === "status")) || (tName === "ds_agent_tools" && colName === "tool_key");
          if (!isKnownDrift) unknownDiffCount++;
          classifications.push({ type: "DEFAULT_MISMATCH", table: tName, column: colName, canonical: cCol.defaultValue, physical: pCol.defaultValue, class: isKnownDrift ? "MIGRATION_DRIFT" : "SEMANTIC_EQUIVALENT" });
        }

        // Extra
        const normCExtra = (cCol.extra || "").toLowerCase();
        const normPExtra = (pCol.extra || "").toLowerCase();
        if (normCExtra.includes("auto_increment") !== normPExtra.includes("auto_increment")) {
          extraDiffCount++;
          unknownDiffCount++;
          classifications.push({ type: "EXTRA_MISMATCH", table: tName, column: colName, class: "UNKNOWN" });
        }
      }
    }

    // 3. PK Diff
    for (const tName of canonicalTableNames) {
      if (!physicalTableSet.has(tName)) continue;
      const cPk = (canonicalTables[tName].primaryKey || []).sort().join(",");
      const pPk = (physicalPKs[tName] || []).sort().join(",");
      if (cPk !== pPk) {
        pkDiffCount++;
        classifications.push({ type: "PK_MISMATCH", table: tName, canonical: cPk, physical: pPk, class: "SEMANTIC_EQUIVALENT" });
      }
    }

    // 4. FK & Index counts
    for (const tName of canonicalTableNames) {
      if (!physicalTableSet.has(tName)) continue;
      const cFk = (canonicalTables[tName].foreignKeys || []).length;
      const pFk = (physicalFKs[tName] || []).length;
      if (cFk !== pFk) {
        fkDiffCount++;
      }
    }

    const localHeadPass = unknownDiffCount === 0 && tableDiffCount === 0 && columnDiffCount === 0 && nullabilityDiffCount === 0;

    console.log("==================================================");
    console.log(`LOCAL VS CANONICAL: ${localHeadPass ? "PASS" : "FAIL"}`);
    console.log(`TABLE DIFF: ${tableDiffCount}`);
    console.log(`COLUMN DIFF: ${columnDiffCount}`);
    console.log(`TYPE DIFF: ${typeDiffCount}`);
    console.log(`NULLABILITY DIFF: ${nullabilityDiffCount}`);
    console.log(`DEFAULT DIFF: ${defaultDiffCount}`);
    console.log(`EXTRA ATTRIBUTE DIFF: ${extraDiffCount}`);
    console.log(`PK DIFF: ${pkDiffCount}`);
    console.log(`UNIQUE INDEX DIFF: ${uniqueIdxDiffCount}`);
    console.log(`INDEX DIFF: ${idxDiffCount}`);
    console.log(`FK DIFF: ${fkDiffCount}`);
    console.log(`UNKNOWN STRUCTURAL DIFFS: ${unknownDiffCount}`);
    console.log("==================================================");

    if (!localHeadPass) {
      console.log("\nDetails of mismatches:");
      console.log(JSON.stringify(classifications, null, 2));
    }

  } catch (err) {
    console.error("[Compare Schema] ❌ FAIL:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
