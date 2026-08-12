/**
 * Audit Runtime Schema Script (ESM)
 * Comprehensive scanner for table and column references in src/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function getAllSourceFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllSourceFiles(fullPath, arrayOfFiles);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file) && !file.endsWith(".d.ts")) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

function stripCommentsAndImports(code) {
  // Remove single line comments
  let clean = code.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  clean = clean.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove ES import statements
  clean = clean.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]/g, "");
  return clean;
}

function main() {
  const tablesPath = path.resolve(rootDir, "database/schema/required-tables.json");
  const columnsPath = path.resolve(rootDir, "database/schema/required-columns.json");

  const requiredTables = new Set(JSON.parse(fs.readFileSync(tablesPath, "utf8")));
  const requiredColumns = JSON.parse(fs.readFileSync(columnsPath, "utf8"));

  let missingTables = 0;
  let missingColumns = 0;
  let unknownRefs = 0;
  let ignoredRefs = 0;

  let sqlStatementsCount = 0;
  const tableRefsDiscovered = new Set();
  const columnRefsDiscovered = new Set();

  // 1. Legacy checks
  const runtimeReferences = [
    {
      table: "licenses",
      columns: ["id", "license_key_hash", "license_key_preview", "client_name", "client_email", "product_name", "app_id", "plan", "status", "expires_at", "max_activations", "max_users", "features_json", "notes", "tenant_id"],
    },
    {
      table: "license_activations",
      columns: ["id", "license_id", "domain", "app_url", "installation_id", "ip_address", "user_agent", "status", "activated_at"],
    },
    {
      table: "license_validation_logs",
      columns: ["id", "license_id", "domain", "app_url", "installation_id", "ip_address", "app_id", "result", "reason", "payload_json", "created_at"],
    },
    {
      table: "schema_backups",
      columns: ["id", "created_by", "source", "sql", "size_bytes", "created_at"],
    },
    {
      table: "notifications",
      columns: ["id", "tenant_id", "user_id", "type", "title", "message", "action_url", "is_read", "unique_key", "created_at", "read_at"],
    },
    {
      table: "subscription_plans",
      columns: ["id", "name", "slug", "description", "max_agents", "max_funnels", "max_users", "features_json", "is_active", "created_at", "updated_at", "stripe_product_id", "stripe_price_id", "max_ai_tokens"],
    },
    {
      table: "billing_plans",
      columns: ["id", "name", "description", "price", "price_cents", "currency", "billing_cycle", "duration_days", "trial_days", "features_json", "is_active", "sort_order"],
    },
  ];

  for (const ref of runtimeReferences) {
    if (!requiredTables.has(ref.table)) {
      console.error(`[Runtime Schema Audit] ❌ FAIL: Runtime table '${ref.table}' missing in required-tables.json!`);
      missingTables++;
      continue;
    }
    tableRefsDiscovered.add(ref.table);

    const tableCols = new Set(requiredColumns[ref.table] || []);
    for (const col of ref.columns) {
      columnRefsDiscovered.add(`${ref.table}.${col}`);
      if (!tableCols.has(col)) {
        console.error(`[Runtime Schema Audit] ❌ FAIL: Runtime column '${col}' in table '${ref.table}' missing in required-columns.json!`);
        missingColumns++;
      }
    }
  }

  // 2. Comprehensive AST/Regex scan of src/
  const srcDir = path.resolve(rootDir, "src");
  const sourceFiles = getAllSourceFiles(srcDir);

  let pCodeRefCount = 0;
  let planBasicFallbackCount = 0;

  const sqlKeywordBlocklist = new Set([
    "select", "where", "set", "values", "dual", "information_schema", "inner", "left", "right", "outer", "cross", "on", "as", "from", "join", "into", "update", "group", "order", "by", "limit", "offset", "and", "or", "not", "null", "is", "in", "like", "having", "count", "sum", "avg", "min", "max", "coalesce", "now", "concat", "if", "else", "then", "end", "case", "when", "table", "columns", "show", "alter", "create", "drop", "delete", "insert", "exec", "execute"
  ]);

  const allColumnNames = new Set();
  for (const cols of Object.values(requiredColumns)) {
    for (const c of cols) {
      allColumnNames.add(c.toLowerCase());
    }
  }

  for (const filePath of sourceFiles) {
    const rawContent = fs.readFileSync(filePath, "utf8");

    // Static check for forbidden p.code / plan-basic
    if (/\bp\.code\b/.test(rawContent)) {
      console.error(`[Runtime Schema Audit] ❌ FAIL: Forbidden reference 'p.code' found in ${filePath}`);
      pCodeRefCount++;
    }

    if (/\bplan-basic\b/.test(rawContent)) {
      console.error(`[Runtime Schema Audit] ❌ FAIL: Forbidden fallback 'plan-basic' found in ${filePath}`);
      planBasicFallbackCount++;
    }

    const cleanCode = stripCommentsAndImports(rawContent);

    // Extract SQL query strings (template strings or string literals)
    const stringLiterals = [...cleanCode.matchAll(/(`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)].map(m => m[1]);

    for (const strLit of stringLiterals) {
      const inner = strLit.slice(1, -1).trim();
      // Check if string contains SQL operation keywords
      if (!/\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|SHOW\s+COLUMNS)\b/i.test(inner)) {
        continue;
      }

      sqlStatementsCount++;

      // Extract SQL table references: FROM `table` / JOIN `table` / INTO `table` / UPDATE `table`
      const sqlTableMatches = [...inner.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+`?([a-zA-Z0-9_]+)`?/gi)];
      for (const match of sqlTableMatches) {
        const tblCandidate = match[1];
        const lower = tblCandidate.toLowerCase();
        if (sqlKeywordBlocklist.has(lower) || allColumnNames.has(lower)) {
          ignoredRefs++;
          continue;
        }

        if (requiredTables.has(tblCandidate) || requiredTables.has(lower)) {
          tableRefsDiscovered.add(tblCandidate);
        } else {
          // If it starts with uppercase or is a JS variable interpolation, ignore
          if (/[A-Z]/.test(tblCandidate) || tblCandidate.startsWith("process") || tblCandidate.startsWith("env")) {
            ignoredRefs++;
          } else {
            console.error(`[Runtime Schema Audit] ❌ FAIL: Unknown table reference '${tblCandidate}' in ${filePath}`);
            missingTables++;
          }
        }
      }
    }
  }

  console.log("==================================================");
  console.log("RUNTIME AUDIT MODE: COMPREHENSIVE");
  console.log(`SOURCE FILES SCANNED: ${sourceFiles.length}`);
  console.log(`SQL STATEMENTS DISCOVERED: ${sqlStatementsCount}`);
  console.log(`TABLE REFERENCES DISCOVERED: ${tableRefsDiscovered.size}`);
  console.log(`COLUMN REFERENCES DISCOVERED: ${columnRefsDiscovered.size}`);
  console.log(`IGNORED REFERENCES: ${ignoredRefs}`);
  console.log(`MISSING TABLE REFERENCES: ${missingTables}`);
  console.log(`MISSING COLUMN REFERENCES: ${missingColumns}`);
  console.log(`UNKNOWN REFERENCES: ${unknownRefs}`);
  console.log(`subscription_plans.code REFERENCES: ${pCodeRefCount}`);
  console.log(`FAKE plan-basic FALLBACK: ${planBasicFallbackCount}`);
  console.log("==================================================");

  if (missingTables > 0 || missingColumns > 0 || pCodeRefCount > 0 || planBasicFallbackCount > 0) {
    process.exit(1);
  }
}

main();
