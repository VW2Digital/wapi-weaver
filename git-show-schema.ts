import { execSync } from "child_process";

async function run() {
  console.log("=== COMPARAÇÃO DE SCHEMA ENTRE HEAD E A BRANCH AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return `ERRO: ${e.message}`;
    }
  };

  const schemaDiff = exec("git diff HEAD origin/audit/whatsapp-crm-validation -- schema_mysql.sql");
  console.log(schemaDiff.split("\n").slice(0, 100).join("\n"));

  process.exit(0);
}

run().catch(console.error);
