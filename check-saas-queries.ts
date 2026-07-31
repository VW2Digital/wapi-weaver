import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== EXTRAINDO CONSULTAS SQL E LOGICAS SAAS DA BRANCH AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // 1. Buscar referências a billing_plans e subscription_plans
  console.log("Buscando referências às tabelas de planos...");
  const bpRefs = exec('git grep -n "billing_plans" origin/audit/whatsapp-crm-validation');
  const spRefs = exec('git grep -n "subscription_plans" origin/audit/whatsapp-crm-validation');

  // 2. Extrair o conteúdo de encryption.ts da branch audit
  console.log("Lendo src/lib/encryption.ts...");
  const encryptionContent = exec("git show origin/audit/whatsapp-crm-validation:src/lib/encryption.ts");

  // 3. Extrair trecho de registro de billing-job no server.ts da branch audit
  console.log("Buscando billing-job no server.ts...");
  const serverJobRefs = exec('git grep -n "billing-job" origin/audit/whatsapp-crm-validation');

  const result = {
    bpRefs: bpRefs.split("\n"),
    spRefs: spRefs.split("\n"),
    encryptionCode: encryptionContent,
    serverJobRefs: serverJobRefs.split("\n")
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_logic_temp.json", JSON.stringify(result, null, 2));
  console.log("Resultados salvos em saas_logic_temp.json.");

  process.exit(0);
}

run().catch(console.error);
