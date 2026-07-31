import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== VERIFICANDO PLAN_ID NO ENSURE-SCHEMA ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:scripts/ensure-schema.js");
  const lines = code.split("\n");
  
  const matches: string[] = [];
  lines.forEach((line, idx) => {
    if (line.includes("plan_id")) {
      matches.push(`L${idx+1}: ${line}`);
    }
  });

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/ensure_schema_plan_id.json", JSON.stringify(matches, null, 2));
  console.log("Salvo.");

  process.exit(0);
}

run().catch(console.error);
