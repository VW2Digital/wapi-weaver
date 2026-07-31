import db from "./src/lib/db";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== DESCRIBING ACTUAL WEBHOOK_EVENTS TABLE ===");
  try {
    const describe = await db.query("DESCRIBE webhook_events") as any[];
    writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/actual_webhook_events.json", JSON.stringify(describe, null, 2));
    console.log("Salvo actual_webhook_events.json.");
  } catch (e: any) {
    console.error("Erro:", e.message);
  }
  process.exit(0);
}

run().catch(console.error);
