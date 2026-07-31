import { execSync } from "child_process";

async function run() {
  console.log("=== LOCALIZAR COMMITS QUE CONTÊM OS ARQUIVOS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return "";
    }
  };

  const files = [
    "src/components/licenses/plans-manager.tsx",
    "src/lib/mercadopago.ts",
    "src/routes/api/billing/checkout.ts"
  ];

  for (const f of files) {
    console.log(`\nProcurando commits contendo o arquivo: ${f}`);
    const commits = exec(`git log --all --oneline --follow -- "${f}"`);
    console.log(commits || "Nenhum commit encontrado.");
  }

  process.exit(0);
}

run().catch(console.error);
