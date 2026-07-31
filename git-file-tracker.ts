import { execSync } from "child_process";

async function run() {
  console.log("=== COMPARAÇÃO DE COMMITS E ARQUIVOS INTRODUZIDOS EM d6f9699 ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return `ERRO: ${e.message}\n${e.stdout || ""}`;
    }
  };

  console.log(exec("git show --name-status d6f9699"));

  console.log("\n=== COMPARAÇÃO DE db432d4 (Adicionou seção admin master) ===");
  console.log(exec("git show --name-status db432d4"));

  process.exit(0);
}

run().catch(console.error);
