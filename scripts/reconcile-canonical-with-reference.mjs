import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
const referencePath = path.resolve(rootDir, "database/schema/reference-schema.sql");

if (!fs.existsSync(referencePath)) {
  console.error("❌ reference-schema.sql missing");
  process.exit(1);
}

let refSql = fs.readFileSync(referencePath, "utf8");

// Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS
let canonicalSql = refSql
  .replace(/^-- REFERENCE SCHEMA.*$/m, "-- CANONICAL SCHEMA (SINGLE SOURCE OF TRUTH FOR WAPI WEAVER)")
  .replace(/CREATE TABLE `([a-zA-Z0-9_]+)`/g, "CREATE TABLE IF NOT EXISTS `$1`");

fs.writeFileSync(canonicalPath, canonicalSql, "utf8");
console.log("✅ Successfully updated canonical-schema.sql from reference-schema.sql");

// Regenerate contracts
execSync("node scripts/generate-schema-contract.js", { cwd: rootDir, stdio: "inherit" });
console.log("✅ Successfully regenerated schema contracts.");
