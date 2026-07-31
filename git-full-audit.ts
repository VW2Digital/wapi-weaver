import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

async function run() {
  console.log("=== EXECUTANDO AUDITORIA SAAS INTEGRAL ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // 1. Identificar arquivos na branch audit e seu status em HEAD
  const filesList = exec("git diff --name-status HEAD origin/audit/whatsapp-crm-validation").split("\n");
  console.log(`Diferenças de arquivos encontradas: ${filesList.length}`);

  // 2. Extrair imports dos principais arquivos a serem restaurados
  const targetFiles = [
    "src/components/licenses/plans-manager.tsx",
    "src/lib/mercadopago.ts",
    "src/lib/stripe.ts",
    "src/lib/subscription-helpers.ts",
    "src/lib/subscription-middleware.ts",
    "src/lib/billing-job.ts",
    "src/routes/_app/billing.tsx",
  ];

  const importsMap: Record<string, string[]> = {};
  for (const f of targetFiles) {
    try {
      // Obter o conteúdo do arquivo na branch audit
      const content = exec(`git show origin/audit/whatsapp-crm-validation:${f}`);
      if (content && !content.startsWith("fatal:")) {
        const imports = content.split("\n")
          .filter(line => line.trim().startsWith("import ") || line.trim().includes("import("))
          .map(line => line.trim());
        importsMap[f] = imports;
      }
    } catch (e) {}
  }

  // 3. Buscar referências a env vars na branch audit
  const envKeywords = [
    "STRIPE", "MERCADOPAGO", "WEBHOOK", "PAYMENT", "BILLING", "CHECKOUT", "APP_URL", "FRONTEND_URL"
  ];
  
  // Buscar no código da branch audit por essas variáveis
  console.log("\nProcurando referências de Env Vars na branch audit...");
  const envRefs: { varName: string, file: string, line: string }[] = [];
  
  const allAuditFiles = exec("git ls-tree -r --name-only origin/audit/whatsapp-crm-validation").split("\n");
  for (const file of allAuditFiles) {
    if (!file.startsWith("src/") || file.includes("node_modules")) continue;
    try {
      const content = exec(`git show origin/audit/whatsapp-crm-validation:${file}`);
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        for (const kw of envKeywords) {
          if (line.includes(kw)) {
            envRefs.push({ varName: kw, file, line: `L${index + 1}: ${line.trim()}` });
          }
        }
      });
    } catch (e) {}
  }

  // 4. Salvar resultados estruturados em JSON para processamento do agente
  const auditReport = {
    files: filesList,
    imports: importsMap,
    envRefs: envRefs.slice(0, 100) // Limite para evitar payload gigante
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/audit_temp.json", JSON.stringify(auditReport, null, 2));
  console.log("Auditoria salva com sucesso em audit_temp.json.");

  process.exit(0);
}

run().catch(console.error);
