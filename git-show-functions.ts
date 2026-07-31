import { execSync } from "child_process";

async function run() {
  console.log("=== EXIBINDO LINHAS DO ARQUIVO LICENSE-ADMIN.FUNCTIONS.TS DA AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:src/lib/license-admin.functions.ts");
  const lines = code.split("\n");
  
  lines.forEach((line, idx) => {
    if (idx >= 290) {
      console.log(`L${idx+1}: ${line}`);
    }
  });

  process.exit(0);
}

run().catch(console.error);
