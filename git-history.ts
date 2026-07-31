import { execSync } from "child_process";

async function run() {
  console.log("=== ANÁLISE DE HISTÓRICO GIT ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return `ERRO: ${e.message}\n${e.stdout || ""}`;
    }
  };

  console.log("\n1. LISTA DE BRANCHES:");
  console.log(exec("git branch -a"));

  console.log("\n2. LISTA DE TAGS:");
  console.log(exec("git tag"));

  console.log("\n3. REFLOG (últimas 30 entradas):");
  console.log(exec("git reflog -n 30"));

  console.log("\n4. BUSCA POR COMMITS DE PLAN/PAYMENT/ADMIN:");
  console.log(exec('git log --all --grep="admin\\|master\\|plan\\|payment\\|subscription\\|billing\\|checkout" --oneline -n 50'));

  console.log("\n5. BUSCA POR ARQUIVOS COM NOMES DE PLAN/PAYMENT/ADMIN EXCLUÍDOS:");
  console.log(exec('git log --all --name-only --oneline -- "*plan*" "*payment*" "*subscription*" "*admin*" | head -n 100'));

  process.exit(0);
}

run().catch(console.error);
