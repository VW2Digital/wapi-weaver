import { execSync } from "child_process";

async function run() {
  console.log("=== BUSCA POR ARQUIVOS SAAS NO HISTÓRICO DE COMMITS ===");

  const exec = (cmd: string) => {
    try {
      return execSync(cmd, { encoding: "utf8" });
    } catch (e: any) {
      return "";
    }
  };

  const output = exec("git log --all --pretty=format: --name-only");
  const files = Array.from(new Set(output.split("\n")))
    .map(f => f.trim())
    .filter(f => f.length > 0);

  const keywords = [
    "admin", "plan", "pay", "subscrip", "billing", "checkout", "gateway", 
    "stripe", "mercadopago", "asaas", "pagarme", "webhook", "license"
  ];

  const matched = files.filter(f => 
    keywords.some(k => f.toLowerCase().includes(k))
  );

  console.log(`Encontrados ${matched.length} arquivos que combinam com as palavras-chave:`);
  console.table(matched.sort());

  process.exit(0);
}

run().catch(console.error);
