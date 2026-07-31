import db from "./src/lib/db";

async function run() {
  console.log("=== DIAGNÓSTICO METAS DO BANCO DE DADOS V2 ===");

  const queries = [
    "Aborted_connects",
    "Aborted_clients",
    "Connections",
    "Threads_connected",
    "Threads_running",
  ];

  for (const q of queries) {
    const res = await db.query(`SHOW GLOBAL STATUS LIKE ?`, [q]) as any[];
    console.log(`${res[0]?.Variable_name}: ${res[0]?.Value}`);
  }

  const connErrors = await db.query(`SHOW GLOBAL STATUS LIKE 'Connection_errors%'`) as any[];
  console.table(connErrors.map(e => ({ Variable_name: e.Variable_name, Value: e.Value })));

  try {
    const hostCache = await db.query(`SELECT * FROM performance_schema.host_cache ORDER BY SUM_CONNECT_ERRORS DESC`) as any[];
    console.log("\nperformance_schema.host_cache:");
    console.table(hostCache);
  } catch (err: any) {
    console.log("\nperformance_schema.host_cache não acessível ou sem permissão:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
