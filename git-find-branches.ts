import { execSync } from "child_process";

async function run() {
  console.log("=== ENCONTRAR QUAIS BRANCHES CONTÊM OS COMMITS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (e: any) {
      return `ERRO: ${e.message}`;
    }
  };

  const commits = ["90f8cce", "4e8d8c4"];

  for (const c of commits) {
    console.log(`\nCommit ${c} está contido nas branches:`);
    console.log(exec(`git branch -a --contains ${c}`));
  }

  process.exit(0);
}

run().catch(console.error);
