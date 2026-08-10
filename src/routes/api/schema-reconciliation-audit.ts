import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";
import db from "@/lib/db";

export const Route = createFileRoute("/api/schema-reconciliation-audit")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const dbNameRows = (await db.query("SELECT DATABASE() as name, VERSION() as ver")) as any[];
          const dbName = dbNameRows[0]?.name || "wapi_weaver";

          // 1. Fetch full physical schema of LOCAL database
          const tablesRows = (await db.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
            [dbName]
          )) as Array<{ TABLE_NAME: string }>;
          const localTables = tablesRows.map((r) => r.TABLE_NAME);
          const functionalTables = localTables.filter((t) => t !== "schema_migrations");

          const columnsRows = (await db.query(`
            SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, CHARACTER_SET_NAME, COLLATION_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = '${dbName}'
            ORDER BY TABLE_NAME, ORDINAL_POSITION
          `)) as any[];

          const pksRows = (await db.query(`
            SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = '${dbName}' AND CONSTRAINT_NAME = 'PRIMARY'
            ORDER BY TABLE_NAME, ORDINAL_POSITION
          `)) as any[];

          const fksRows = (await db.query(`
            SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = '${dbName}' AND REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY TABLE_NAME, CONSTRAINT_NAME
          `)) as any[];

          const indexesRows = (await db.query(`
            SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = '${dbName}'
            ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
          `)) as any[];

          // Structured Local Schema
          const localSchema: Record<string, any> = {};
          for (const t of functionalTables) {
            localSchema[t] = {
              columns: {},
              pks: [],
              fks: [],
              indexes: {},
            };
          }

          for (const row of columnsRows) {
            if (row.TABLE_NAME === "schema_migrations") continue;
            if (!localSchema[row.TABLE_NAME]) continue;
            localSchema[row.TABLE_NAME].columns[row.COLUMN_NAME] = {
              ordinal: row.ORDINAL_POSITION,
              dataType: row.DATA_TYPE,
              columnType: row.COLUMN_TYPE,
              nullable: row.IS_NULLABLE === "YES",
              default: row.COLUMN_DEFAULT,
              key: row.COLUMN_KEY,
              extra: row.EXTRA,
              charset: row.CHARACTER_SET_NAME,
              collation: row.COLLATION_NAME,
            };
          }

          for (const row of pksRows) {
            if (row.TABLE_NAME === "schema_migrations") continue;
            if (localSchema[row.TABLE_NAME]) {
              localSchema[row.TABLE_NAME].pks.push(row.COLUMN_NAME);
            }
          }

          for (const row of fksRows) {
            if (row.TABLE_NAME === "schema_migrations") continue;
            if (localSchema[row.TABLE_NAME]) {
              localSchema[row.TABLE_NAME].fks.push({
                column: row.COLUMN_NAME,
                refTable: row.REFERENCED_TABLE_NAME,
                refColumn: row.REFERENCED_COLUMN_NAME,
                constraint: row.CONSTRAINT_NAME,
              });
            }
          }

          for (const row of indexesRows) {
            if (row.TABLE_NAME === "schema_migrations") continue;
            if (localSchema[row.TABLE_NAME]) {
              if (!localSchema[row.TABLE_NAME].indexes[row.INDEX_NAME]) {
                localSchema[row.TABLE_NAME].indexes[row.INDEX_NAME] = {
                  nonUnique: row.NON_UNIQUE === 1,
                  columns: [],
                };
              }
              localSchema[row.TABLE_NAME].indexes[row.INDEX_NAME].columns.push(row.COLUMN_NAME);
            }
          }

          // Read Canonical Schema SQL
          const canonicalPath = path.resolve(process.cwd(), "database/schema/canonical-schema.sql");
          const canonicalSql = fs.readFileSync(canonicalPath, "utf8");

          // Parse Canonical Schema Tables and Columns using regex
          const canonicalSchema: Record<string, { columns: Record<string, string>; pks: string[]; fks: any[] }> = {};
          const createTableBlocks = canonicalSql.split(/CREATE TABLE IF NOT EXISTS /i).slice(1);

          for (const block of createTableBlocks) {
            const tableNameMatch = block.match(/^`?([a-zA-Z0-9_]+)`?\s*\(/);
            if (!tableNameMatch) continue;
            const tableName = tableNameMatch[1];
            if (tableName === "schema_migrations") continue;

            canonicalSchema[tableName] = { columns: {}, pks: [], fks: [] };
            const lines = block.split("\n");
            for (let line of lines) {
              line = line.trim();
              if (line.startsWith("PRIMARY KEY")) {
                const pkCols = line.match(/\(([^)]+)\)/);
                if (pkCols) {
                  canonicalSchema[tableName].pks = pkCols[1].split(",").map((c) => c.replace(/`/g, "").trim());
                }
              } else if (line.startsWith("FOREIGN KEY")) {
                const fkMatch = line.match(/FOREIGN KEY\s*\(`?([^`]+)`?\)\s*REFERENCES\s*`?([^`\s(]+)`?\s*\(`?([^`]+)`?\)/i);
                if (fkMatch) {
                  canonicalSchema[tableName].fks.push({
                    column: fkMatch[1],
                    refTable: fkMatch[2],
                    refColumn: fkMatch[3],
                  });
                }
              } else if (line.startsWith("`")) {
                const colMatch = line.match(/^`([^`]+)`\s+([^,]+)/);
                if (colMatch) {
                  const colName = colMatch[1];
                  const colDef = colMatch[2].trim();
                  canonicalSchema[tableName].columns[colName] = colDef;
                  if (colDef.includes("PRIMARY KEY") && canonicalSchema[tableName].pks.length === 0) {
                    canonicalSchema[tableName].pks.push(colName);
                  }
                }
              }
            }
          }

          // A) LOCAL vs required-columns.json (Manifest-only)
          const reqColsPath = path.resolve(process.cwd(), "database/schema/required-columns.json");
          const reqColsMap: Record<string, string[]> = fs.existsSync(reqColsPath)
            ? JSON.parse(fs.readFileSync(reqColsPath, "utf8"))
            : {};

          const manifestDiffs: Record<string, { missingInManifest: string[]; extraInManifest: string[] }> = {};
          let totalManifestDiffs = 0;

          for (const t of functionalTables) {
            const localCols = Object.keys(localSchema[t].columns);
            const reqCols = reqColsMap[t] || [];
            const missingInManifest = localCols.filter((c) => !reqCols.includes(c));
            const extraInManifest = reqCols.filter((c) => !localCols.includes(c));
            if (missingInManifest.length > 0 || extraInManifest.length > 0) {
              manifestDiffs[t] = { missingInManifest, extraInManifest };
              totalManifestDiffs += missingInManifest.length + extraInManifest.length;
            }
          }

          // B) LOCAL vs Canonical Schema SQL
          const canonicalTables = Object.keys(canonicalSchema);
          const localOnlyCanonical = functionalTables.filter((t) => !canonicalSchema[t]);
          const canonicalOnlyLocal = canonicalTables.filter((t) => !localSchema[t]);

          const canonicalColDiffs: Record<string, { missingInCanonical: string[]; extraInCanonical: string[] }> = {};
          let totalCanonicalColDiffs = 0;

          for (const t of functionalTables) {
            if (!canonicalSchema[t]) continue;
            const localCols = Object.keys(localSchema[t].columns);
            const canCols = Object.keys(canonicalSchema[t].columns);

            const missingInCanonical = localCols.filter((c) => !canCols.includes(c));
            const extraInCanonical = canCols.filter((c) => !localCols.includes(c));

            if (missingInCanonical.length > 0 || extraInCanonical.length > 0) {
              canonicalColDiffs[t] = { missingInCanonical, extraInCanonical };
              totalCanonicalColDiffs += missingInCanonical.length + extraInCanonical.length;
            }
          }

          // Detailed Classification of Diffs across all 93 functional tables
          const classifiedDiffs: Array<{
            table: string;
            column?: string;
            category:
              | "MANIFEST_ONLY"
              | "CANONICAL_MISSING"
              | "MIGRATION_MISSING"
              | "TYPE_MISMATCH"
              | "NULLABILITY_MISMATCH"
              | "DEFAULT_MISMATCH"
              | "INDEX_MISMATCH"
              | "FK_MISMATCH"
              | "LEGACY_EXTRA"
              | "DESTRUCTIVE_CHANGE_REQUIRED";
            details: string;
            actionRequired: "CANONICAL" | "MIGRATION" | "MANIFEST" | "NONE";
          }> = [];

          // 1. Manifest Diffs
          for (const [table, diff] of Object.entries(manifestDiffs)) {
            for (const col of diff.missingInManifest) {
              classifiedDiffs.push({
                table,
                column: col,
                category: "MANIFEST_ONLY",
                details: `Column '${col}' exists in local DB but is missing in required-columns.json`,
                actionRequired: "MANIFEST",
              });
            }
            for (const col of diff.extraInManifest) {
              classifiedDiffs.push({
                table,
                column: col,
                category: "LEGACY_EXTRA",
                details: `Column '${col}' is listed in required-columns.json but does not exist in local DB`,
                actionRequired: "MANIFEST",
              });
            }
          }

          // 2. Canonical Diffs
          for (const [table, diff] of Object.entries(canonicalColDiffs)) {
            for (const col of diff.missingInCanonical) {
              classifiedDiffs.push({
                table,
                column: col,
                category: "CANONICAL_MISSING",
                details: `Column '${col}' exists in local DB but is missing in canonical-schema.sql`,
                actionRequired: "CANONICAL",
              });
            }
            for (const col of diff.extraInCanonical) {
              classifiedDiffs.push({
                table,
                column: col,
                category: "LEGACY_EXTRA",
                details: `Column '${col}' exists in canonical-schema.sql but is missing in local DB`,
                actionRequired: "CANONICAL",
              });
            }
          }

          // 3. PK & FK Diffs check vs Canonical
          for (const t of functionalTables) {
            if (canonicalSchema[t]) {
              const localPK = localSchema[t].pks.join(",");
              const canPK = canonicalSchema[t].pks.join(",");
              if (localPK !== canPK) {
                classifiedDiffs.push({
                  table: t,
                  category: "PK_MISMATCH" as any,
                  details: `Local PK [${localPK}] does not match Canonical PK [${canPK}]`,
                  actionRequired: "CANONICAL",
                });
              }
            }
          }

          return new Response(
            JSON.stringify(
              {
                summary: {
                  localPhysicalTables: localTables.length,
                  localFunctionalTables: functionalTables.length,
                  canonicalFunctionalTables: canonicalTables.length,
                  reqTablesManifestCount: Object.keys(reqColsMap).length,
                  localOnlyCanonical,
                  canonicalOnlyLocal,
                  tablesWithManifestColDiff: Object.keys(manifestDiffs).length,
                  totalManifestColDiffs: totalManifestDiffs,
                  tablesWithCanonicalColDiff: Object.keys(canonicalColDiffs).length,
                  totalCanonicalColDiffs: totalCanonicalColDiffs,
                  totalClassifiedDiffs: classifiedDiffs.length,
                },
                manifestDiffs,
                canonicalColDiffs,
                classifiedDiffs,
                localSchema,
              },
              null,
              2
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
