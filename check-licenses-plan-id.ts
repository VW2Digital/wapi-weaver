import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== BUSCANDO ESTRUTURA DE LICENSES E PLAN_ID PROGRAMÁTICO ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // Get ensure-schema.js from the audit branch
  const ensureSchemaContent = exec("git show origin/audit/whatsapp-crm-validation:scripts/ensure-schema.js");
  const ensureSchemaLines = ensureSchemaContent.split("\n");

  const licenseTableDef: string[] = [];
  let capture = false;
  ensureSchemaLines.forEach((line) => {
    if (line.includes("CREATE TABLE IF NOT EXISTS licenses") || line.includes("CREATE TABLE licenses")) {
      capture = true;
    }
    if (capture) {
      licenseTableDef.push(line);
      if (line.includes("ENGINE=")) {
        capture = false;
      }
    }
  });

  // Also query schema_mysql.sql definition of licenses
  const schemaSqlContent = exec("git show origin/audit/whatsapp-crm-validation:schema_mysql.sql");
  const schemaSqlLines = schemaSqlContent.split("\n");
  const schemaSqlLicenseTable: string[] = [];
  let captureSql = false;
  schemaSqlLines.forEach((line) => {
    if (line.includes("CREATE TABLE IF NOT EXISTS licenses") || line.includes("CREATE TABLE licenses")) {
      captureSql = true;
    }
    if (captureSql) {
      schemaSqlLicenseTable.push(line);
      if (line.includes("ENGINE=")) {
        captureSql = false;
      }
    }
  });

  const result = {
    licenseTableDef,
    schemaSqlLicenseTable
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_license_plan_temp.json", JSON.stringify(result, null, 2));
  console.log("Salvo programaticamente em saas_license_plan_temp.json.");

  process.exit(0);
}

run().catch(console.error);
