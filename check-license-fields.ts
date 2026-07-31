import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== BUSCANDO ARQUIVOS COM REFERÊNCIAS A LICENSES E PLAN_ID ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // Find occurrences of l.plan_id in audit branch
  const planIdRefs = exec('git grep -n "plan_id" origin/audit/whatsapp-crm-validation');
  
  // Find ALTER TABLE references specifically targeting licenses
  const licenseAlterRefs = exec('git grep -n "ALTER TABLE licenses" origin/audit/whatsapp-crm-validation');

  const result = {
    planIdRefs: planIdRefs.split("\n").filter(line => line.includes("licenses") || line.includes("l.")),
    licenseAlterRefs: licenseAlterRefs.split("\n")
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_license_fields_temp.json", JSON.stringify(result, null, 2));
  console.log("Salvo em saas_license_fields_temp.json.");

  process.exit(0);
}

run().catch(console.error);
