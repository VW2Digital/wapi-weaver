import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== EXIBINDO WEBHOOK_EVENTS NO ENSURE-SCHEMA ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:scripts/ensure-schema.js");
  const lines = code.split("\n");
  
  const webhookTableDef: string[] = [];
  let capture = false;
  lines.forEach((line, idx) => {
    if (idx >= 2055 && idx <= 2080) {
      webhookTableDef.push(`L${idx+1}: ${line}`);
    }
  });

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/webhook_ensure_schema_temp.json", JSON.stringify(webhookTableDef, null, 2));
  console.log("Salvo.");

  process.exit(0);
}

run().catch(console.error);
