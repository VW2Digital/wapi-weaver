import { execSync } from "child_process";

async function run() {
  console.log("=== EXIBINDO CODIGO DO BILLING-JOB.TS DA AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:src/lib/billing-job.ts");
  console.log(code);

  process.exit(0);
}

run().catch(console.error);
