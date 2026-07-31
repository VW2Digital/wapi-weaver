import db from "./src/lib/db";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== COMPROVAÇÃO DE SCHEMAS E EVIDÊNCIAS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // 1. SHOW CREATE TABLE notifications & SHOW INDEX FROM notifications
  let notificationsCreate = "";
  let notificationsIndexes: any[] = [];
  try {
    const resCreate = await db.query("SHOW CREATE TABLE notifications") as any[];
    notificationsCreate = resCreate[0]?.["Create Table"] || "";
    notificationsIndexes = await db.query("SHOW INDEX FROM notifications") as any[];
  } catch (e: any) {
    notificationsCreate = `Error: ${e.message}`;
  }

  // 2. Buscar como licenses.plan_id ou billing_plans se conectam no código da branch audit
  console.log("Buscando scripts de atualização de schema na branch audit...");
  const updateBillingSchema = exec("git show origin/audit/whatsapp-crm-validation:scripts/update-billing-schema.ts");
  const updatePlansSchema = exec("git show origin/audit/whatsapp-crm-validation:scripts/update-plans-schema.ts");

  const result = {
    notifications: {
      createTable: notificationsCreate,
      indexes: notificationsIndexes
    },
    updateBillingSchema,
    updatePlansSchema
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_validation_temp.json", JSON.stringify(result, null, 2));
  console.log("Salvo com sucesso em saas_validation_temp.json.");

  process.exit(0);
}

run().catch(console.error);
