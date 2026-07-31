import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== ENCONTRANDO MIGRATIONS DE TABELAS NA BRANCH AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const alterRefs = exec('git grep -n "ALTER TABLE" origin/audit/whatsapp-crm-validation');
  const addColumnRefs = exec('git grep -n "addColumnIfNotExists" origin/audit/whatsapp-crm-validation');
  const createTableRefs = exec('git grep -n "CREATE TABLE" origin/audit/whatsapp-crm-validation');

  const result = {
    alterRefs: alterRefs.split("\n"),
    addColumnRefs: addColumnRefs.split("\n"),
    createTableRefs: createTableRefs.split("\n")
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_migration_refs.json", JSON.stringify(result, null, 2));
  console.log("Salvo em saas_migration_refs.json.");

  process.exit(0);
}

run().catch(console.error);
