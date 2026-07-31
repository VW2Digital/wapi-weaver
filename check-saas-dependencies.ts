import { execSync } from "child_process";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== ANÁLISE DE DEPENDÊNCIAS DE ENCRYPTION, GATEWAY E LICENSE-ADMIN ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  // 1. Obter imports de src/lib/encryption.ts na branch audit
  const encryptionContent = exec("git show origin/audit/whatsapp-crm-validation:src/lib/encryption.ts");
  const encryptionImports = encryptionContent.split("\n")
    .filter(line => line.trim().startsWith("import ") || line.trim().includes("import("))
    .map(line => line.trim());

  // 2. Obter imports de src/components/licenses/gateway-settings.tsx na branch audit
  const gatewayContent = exec("git show origin/audit/whatsapp-crm-validation:src/components/licenses/gateway-settings.tsx");
  const gatewayImports = gatewayContent.split("\n")
    .filter(line => line.trim().startsWith("import ") || line.trim().includes("import("))
    .map(line => line.trim());

  // 3. Obter imports de src/lib/license-admin.functions.ts na branch audit
  const licenseContent = exec("git show origin/audit/whatsapp-crm-validation:src/lib/license-admin.functions.ts");
  const licenseImports = licenseContent.split("\n")
    .filter(line => line.trim().startsWith("import ") || line.trim().includes("import("))
    .map(line => line.trim());

  const result = {
    encryptionImports,
    gatewayImports,
    licenseImports
  };

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/saas_deps_temp.json", JSON.stringify(result, null, 2));
  console.log("Salvo em saas_deps_temp.json.");

  process.exit(0);
}

run().catch(console.error);
