import db from "./src/lib/db";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== LISTANDO PLANOS COMERCIAIS EXISTENTES ===");
  try {
    const plans = await db.query("SELECT * FROM billing_plans") as any[];
    const subPlans = await db.query("SELECT * FROM subscription_plans") as any[];
    
    writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/actual_plans_data.json", JSON.stringify({
      billing_plans: plans,
      subscription_plans: subPlans
    }, null, 2));
    console.log("Salvo actual_plans_data.json.");
  } catch (e: any) {
    console.error("Erro:", e.message);
  }
  process.exit(0);
}

run().catch(console.error);
