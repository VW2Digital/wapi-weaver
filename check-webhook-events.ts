import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== VERIFICANDO WEBHOOK_EVENTS NO SCHEMA ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:schema_mysql.sql");
  const lines = code.split("\n");
  
  const webhookTableDef: string[] = [];
  let capture = false;
  lines.forEach((line) => {
    if (line.includes("CREATE TABLE IF NOT EXISTS webhook_events") || line.includes("CREATE TABLE webhook_events")) {
      capture = true;
    }
    if (capture) {
      webhookTableDef.push(line);
      if (line.includes("ENGINE=")) {
        capture = false;
      }
    }
  });

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/webhook_events_schema.json", JSON.stringify(webhookTableDef, null, 2));
  console.log("Salvo.");

  process.exit(0);
}

run().catch(console.error);
