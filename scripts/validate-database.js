import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
const dotenvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  console.log("=================================================");
  console.log("  VALIDATING DATABASE SCHEMA & DATA INTEGRITY    ");
  console.log("=================================================");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[DB Validation] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const dbConfig = {
    host: process.env.DB_HOST || "mysql",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: dbPassword,
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("[DB Validation] ✅ SUCCESS: Connected to MySQL database.");
  } catch (err) {
    console.error("[DB Validation] ❌ FAIL: Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  try {
    // 1. Load required tables and columns manifests (Single Contract)
    const tablesPath = path.resolve(__dirname, "../database/schema/required-tables.json");
    const columnsPath = path.resolve(__dirname, "../database/schema/required-columns.json");

    const requiredTables = JSON.parse(fs.readFileSync(tablesPath, "utf8"));
    const requiredColumns = JSON.parse(fs.readFileSync(columnsPath, "utf8"));

    // 2. Verify schema_migrations contains all physical migration files and no orphan records exist
    const migrationsDir = path.resolve(__dirname, "../database/migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.error("[DB Validation] ❌ FAIL: Migrations directory not found at " + migrationsDir);
      process.exit(1);
    }

    const expectedMigrations = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const [migrations] = await connection.query("SELECT version FROM schema_migrations");
    const appliedVersions = new Set(migrations.map((m) => m.version));

    // Check all physical files are recorded in database
    for (const mig of expectedMigrations) {
      if (!appliedVersions.has(mig)) {
        console.error(`[DB Validation] ❌ FAIL: Migration file '${mig}' exists on disk but is missing in schema_migrations table!`);
        process.exit(1);
      }
    }

    // Check orphan migrations in database without physical file
    const expectedSet = new Set(expectedMigrations);
    for (const applied of appliedVersions) {
      if (!expectedSet.has(applied)) {
        console.error(`[DB Validation] ❌ FAIL: Orphan migration '${applied}' found in schema_migrations table but missing on disk!`);
        process.exit(1);
      }
    }

    console.log(`[DB Validation] ✅ SUCCESS: All ${expectedMigrations.length} physical migrations verified in schema_migrations (no orphans).`);

    // 3. Verify required tables physically exist
    const [tables] = await connection.query("SHOW TABLES");
    const existingTables = new Set(tables.map((t) => Object.values(t)[0]));
    const missingTables = requiredTables.filter((tbl) => !existingTables.has(tbl));

    if (missingTables.length > 0) {
      console.error(`[DB Validation] ❌ FAIL: Missing required table(s): ${missingTables.join(", ")}`);
      process.exit(1);
    }
    console.log(`[DB Validation] ✅ SUCCESS: All ${requiredTables.length} essential tables physically exist.`);

    // 4. Verify required columns physically exist
    let columnErrors = 0;
    for (const [table, columns] of Object.entries(requiredColumns)) {
      if (!existingTables.has(table)) {
        console.error(`[DB Validation] ❌ FAIL: Table '${table}' missing for column verification.`);
        columnErrors++;
        continue;
      }

      const [colRows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      const existingCols = new Set(colRows.map((c) => c.Field));

      for (const col of columns) {
        if (!existingCols.has(col)) {
          console.error(`[DB Validation] ❌ FAIL: Column '${col}' missing in table '${table}'.`);
          columnErrors++;
        }
      }
    }

    if (columnErrors > 0) {
      console.error(`[DB Validation] ❌ FAIL: Found ${columnErrors} missing required column(s).`);
      process.exit(1);
    }
    console.log("[DB Validation] ✅ SUCCESS: All required columns verified.");

    // 5. Verify admin user strictly has role 'admin_master'
    const adminEmail = (process.env.ADMIN_EMAIL || "adm@vw2digital.com.br").trim().toLowerCase();
    const [adminRows] = await connection.query(
      `SELECT u.id, u.email, r.role 
       FROM users u 
       JOIN user_roles r ON u.id = r.user_id 
       WHERE LOWER(TRIM(u.email)) = ?`,
      [adminEmail],
    );

    if (adminRows.length === 0) {
      console.error(`[DB Validation] ❌ FAIL: Admin user '${adminEmail}' not found or missing user_roles record.`);
      process.exit(1);
    }

    const adminRole = adminRows[0].role;
    if (adminRole !== "admin_master") {
      console.error(`[DB Validation] ❌ FAIL: Admin user '${adminEmail}' has role '${adminRole}', but strictly requires 'admin_master'.`);
      process.exit(1);
    }
    console.log(`[DB Validation] ✅ SUCCESS: Admin user '${adminEmail}' verified with strict role 'admin_master'.`);

    // 6. Verify no invalid roles exist in user_roles
    const [invalidRoles] = await connection.query(
      `SELECT id, user_id, role FROM user_roles WHERE role NOT IN ('admin_master', 'admin', 'user')`,
    );

    if (invalidRoles.length > 0) {
      console.error(`[DB Validation] ❌ FAIL: Found ${invalidRoles.length} invalid role(s) in user_roles table.`);
      process.exit(1);
    }
    console.log("[DB Validation] ✅ SUCCESS: No invalid roles found in user_roles.");

    console.log("=================================================");
    console.log("  DATABASE VALIDATION PASSED SUCCESSFULLY        ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[DB Validation] ❌ FAIL: Database validation failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
