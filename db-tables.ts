import db from "./src/lib/db";

async function run() {
  console.log("=== TABELAS EXISTENTES NO BANCO DE DADOS ===");
  try {
    const tables = await db.query("SHOW TABLES") as any[];
    console.log("Tabelas encontradas:");
    console.table(tables.map(row => Object.values(row)[0]));
  } catch (err: any) {
    console.error("Erro ao listar tabelas:", err.message);
  }
  process.exit(0);
}

run().catch(console.error);
