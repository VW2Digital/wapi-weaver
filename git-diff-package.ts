import { execSync } from "child_process";

async function run() {
  console.log("=== COMPARAÇÃO DE DEPENDÊNCIAS NO PACKAGE.JSON ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return `ERRO: ${e.message}`;
    }
  };

  console.log(exec("git diff HEAD origin/audit/whatsapp-crm-validation -- package.json"));

  process.exit(0);
}

run().catch(console.error);
