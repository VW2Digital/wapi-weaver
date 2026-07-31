import { execSync } from "child_process";

async function run() {
  console.log("=== EXIBINDO LINHAS DE NAVITEMS DO APP.TSX DA AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:src/routes/_app.tsx");
  const lines = code.split("\n");
  
  lines.forEach((line, idx) => {
    if (idx >= 170 && idx <= 210) {
      console.log(`L${idx+1}: ${line}`);
    }
  });

  process.exit(0);
}

run().catch(console.error);
