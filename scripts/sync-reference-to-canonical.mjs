import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
const referencePath = path.resolve(rootDir, "database/schema/reference-schema.sql");

let canSql = fs.readFileSync(canonicalPath, "utf8");

let refSql = canSql
  .replace(/^-- CANONICAL SCHEMA.*$/m, "-- REFERENCE SCHEMA (DDL ONLY - SINGLE SOURCE OF TRUTH FROM LOCAL MYSQL)")
  .replace(/CREATE TABLE IF NOT EXISTS/g, "CREATE TABLE");

fs.writeFileSync(referencePath, refSql, "utf8");
console.log("✅ Synchronized reference-schema.sql with canonical-schema.sql.");
