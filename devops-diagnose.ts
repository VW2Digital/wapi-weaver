import { execSync } from "child_process";

async function run() {
  console.log("=== DIAGNÓSTICO DE VERSÃO E GIT ===");
  try {
    console.log("Git Status:");
    console.log(execSync("git status", { encoding: "utf8" }));
  } catch (err: any) {
    console.error("Erro no git status:", err.message);
  }

  try {
    console.log("Branch Atual:");
    console.log(execSync("git branch --show-current", { encoding: "utf8" }).trim());
  } catch (err: any) {
    console.error("Erro no git branch:", err.message);
  }

  try {
    console.log("Commit Hash (HEAD):");
    console.log(execSync("git rev-parse HEAD", { encoding: "utf8" }).trim());
  } catch (err: any) {
    console.error("Erro no git rev-parse:", err.message);
  }

  try {
    console.log("Último Commit:");
    console.log(execSync("git log -1 --oneline", { encoding: "utf8" }).trim());
  } catch (err: any) {
    console.error("Erro no git log:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
