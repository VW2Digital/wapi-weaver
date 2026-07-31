import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== VERIFICANDO TODAS AS REFERÊNCIAS A WEBHOOK_EVENTS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const refs = exec('git grep -n "webhook_events" origin/audit/whatsapp-crm-validation');
  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/webhook_events_refs.json", JSON.stringify(refs.split("\n"), null, 2));
  console.log("Salvo refs.");

  process.exit(0);
}

run().catch(console.error);
