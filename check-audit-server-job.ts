import { execSync } from "child_process";

async function run() {
  console.log("=== LENDO REGISTRO DE JOBS NO SERVER.TS DA AUDIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return "";
    }
  };

  const code = exec("git show origin/audit/whatsapp-crm-validation:src/server.ts");
  const lines = code.split("\n");
  
  // Find lines containing billing-job or runBillingJob
  lines.forEach((line, idx) => {
    if (line.includes("billing-job") || line.includes("runBillingJob") || line.includes("Interval")) {
      console.log(`L${idx+1}: ${line}`);
    }
  });

  process.exit(0);
}

run().catch(console.error);
