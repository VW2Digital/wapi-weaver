import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== ANÁLISE DE ATIVAÇÃO DE LICENÇA E WEBHOOKS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // 1. Obter trechos de webhook de mercadopago.ts da branch audit
  const mpWebhook = exec("git show origin/audit/whatsapp-crm-validation:src/routes/api/webhooks/mercadopago.ts");
  
  // 2. Obter trechos de subscription-helpers.ts para ver getOrCreateSubscription ou ativações
  const subHelpers = exec("git show origin/audit/whatsapp-crm-validation:src/lib/subscription-helpers.ts");

  const result = {
    mpWebhookLines: mpWebhook.split("\n").slice(0, 200), // view first 200 lines
    subHelpersLines: subHelpers.split("\n")
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_webhook_logic_temp.json", JSON.stringify(result, null, 2));
  console.log("Salvo em saas_webhook_logic_temp.json.");

  process.exit(0);
}

run().catch(console.error);
