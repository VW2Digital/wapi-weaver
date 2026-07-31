import { execSync } from "child_process";

async function run() {
  console.log("=== EXIBINDO LINHAS DO SERVER.TS DA AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:src/server.ts");
  const lines = code.split("\n");
  console.log(lines.slice(480, 510).join("\n"));

  process.exit(0);
}

run().catch(console.error);
