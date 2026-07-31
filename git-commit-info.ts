import { execSync } from "child_process";

async function run() {
  console.log("=== INFORMAÇÕES DE COMMITS DE ORIGEM V2 ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return "";
    }
  };

  const commits = ["90f8cce", "4e8d8c4"];

  for (const c of commits) {
    console.log(`\n--- Commit: ${c} ---`);
    console.log(exec(`git show --quiet --pretty=medium ${c}`));
    console.log("Arquivos alterados:");
    const fileList = exec(`git show --name-status ${c}`);
    // Print first 40 lines of output
    console.log(fileList.split("\n").slice(0, 40).join("\n"));
  }

  process.exit(0);
}

run().catch(console.error);
