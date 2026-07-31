import { execSync } from "child_process";

async function run() {
  console.log("=== VERIFICAR SE COMMITS SÃO ANCESTORES E QUANDO FORAM DELETADOS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return `ERRO: ${e.message}`;
    }
  };

  const commits = ["90f8cce", "4e8d8c4"];

  for (const c of commits) {
    const isAncestor = exec(`git merge-base --is-ancestor ${c} HEAD && echo "SIM" || echo "NÃO"`);
    console.log(`Commit ${c} é ancestral de HEAD? ${isAncestor}`);
    
    if (isAncestor.includes("SIM")) {
      console.log(`Commit que removeu o arquivo plans-manager.tsx a partir de ${c}:`);
      console.log(exec(`git log ${c}..HEAD --oneline --diff-filter=D --summary`));
    }
  }

  process.exit(0);
}

run().catch(console.error);
