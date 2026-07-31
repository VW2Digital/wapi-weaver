import { execSync } from "child_process";

async function run() {
  console.log("=== COMPARAÇÃO DE ARQUIVOS ENTRE HEAD E A BRANCH AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return `ERRO: ${e.message}`;
    }
  };

  const diffOutput = exec("git diff --name-status HEAD origin/audit/whatsapp-crm-validation");
  console.log(diffOutput.split("\n").slice(0, 80).join("\n"));

  process.exit(0);
}

run().catch(console.error);
