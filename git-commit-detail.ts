import { execSync } from "child_process";

async function run() {
  console.log("=== ANÁLISE DE COMMITS RECENTES ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return `ERRO: ${e.message}\n${e.stdout || ""}`;
    }
  };

  // Inspect what changed in 0bd01b3
  console.log("\n1. ARQUIVOS MODIFICADOS NO COMMIT 0bd01b3:");
  console.log(exec("git show --name-status 0bd01b3"));

  // Inspect 29db657
  console.log("\n2. ARQUIVOS MODIFICADOS NO COMMIT 29db657:");
  console.log(exec("git show --name-status 29db657"));

  // Check files in the current commit that were deleted or modified compared to earlier commits (e.g. d535d58 or d6f9699)
  console.log("\n3. ARQUIVOS DELETADOS EM GERAL (git log --diff-filter=D):");
  console.log(exec("git log --diff-filter=D --summary --oneline -n 30"));

  process.exit(0);
}

run().catch(console.error);
