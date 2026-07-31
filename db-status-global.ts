import db from "./src/lib/db";

async function run() {
  console.log("=== STATUS GLOBAL DO BANCO DE DADOS ===");

  const queries = [
    "Aborted_connects",
    "Aborted_clients",
    "Threads_connected",
    "Threads_running",
    "Max_used_connections",
  ];

  for (const q of queries) {
    const res = await db.query(`SHOW GLOBAL STATUS LIKE ?`, [q]) as any[];
    console.log(`${res[0]?.Variable_name}: ${res[0]?.Value}`);
  }

  process.exit(0);
}

run().catch(console.error);
