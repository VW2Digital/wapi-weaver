import { execSync } from "child_process";

async function run() {
  console.log("=== ENCONTRAR COMMITS QUE EXCLUÍRAM OS ARQUIVOS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return `ERRO: ${e.message}`;
    }
  };

  // Find commit that deleted src/components/licenses/plans-manager.tsx
  console.log("\n1. Commit que excluiu plans-manager.tsx:");
  console.log(exec("git log -n 1 --diff-filter=D --summary --oneline -- src/components/licenses/plans-manager.tsx"));

  // Find commit that deleted src/lib/mercadopago.ts
  console.log("\n2. Commit que excluiu mercadopago.ts:");
  console.log(exec("git log -n 1 --diff-filter=D --summary --oneline -- src/lib/mercadopago.ts"));

  // Find commit that deleted src/routes/api/billing/checkout.ts
  console.log("\n3. Commit que excluiu api/billing/checkout.ts:");
  console.log(exec("git log -n 1 --diff-filter=D --summary --oneline -- src/routes/api/billing/checkout.ts"));

  process.exit(0);
}

run().catch(console.error);
