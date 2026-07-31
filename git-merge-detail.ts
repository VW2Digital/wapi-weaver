import { execSync } from "child_process";

async function run() {
  console.log("=== ANÁLISE DETALHADA DOS MERGES DE CHECKOUT E ADMIN MASTER ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return `ERRO: ${e.message}\n${e.stdout || ""}`;
    }
  };

  console.log("\n1. MUDANÇAS DO MERGE d6f9699 (Checkout):");
  // Using ~ instead of ^ to avoid Windows shell escaping issues
  console.log(exec("git diff --name-status d6f9699~1 d6f9699"));

  console.log("\n2. MUDANÇAS DO MERGE db432d4 (Admin Master):");
  console.log(exec("git diff --name-status db432d4~1 db432d4"));

  process.exit(0);
}

run().catch(console.error);
