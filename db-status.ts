import db from "./src/lib/db";

async function run() {
  console.log("=== DIAGNÓSTICO METAS DO BANCO DE DADOS ===");

  // 1. Mostrar status das conexões
  const variables = [
    "max_connections",
  ];
  for (const v of variables) {
    const res = await db.query(`SHOW VARIABLES LIKE ?`, [v]) as any[];
    console.log(`${v}:`, res[0]?.Value);
  }

  const statuses = [
    "Threads_connected",
    "Threads_running",
    "Max_used_connections",
    "Aborted_connects",
  ];
  for (const s of statuses) {
    const res = await db.query(`SHOW STATUS LIKE ?`, [s]) as any[];
    console.log(`${s}:`, res[0]?.Value);
  }

  // 2. Quantidade total de linhas para contexto
  const chatCount = await db.query("SELECT COUNT(*) AS total FROM chat_sessions") as any[];
  const msgCount = await db.query("SELECT COUNT(*) AS total FROM campaign_messages") as any[];
  console.log("\nLinhas no Banco:");
  console.log(`- chat_sessions: ${chatCount[0].total}`);
  console.log(`- campaign_messages: ${msgCount[0].total}`);

  // 3. EXPLAIN ANALYZE das queries reais
  console.log("\n=== EXPLAIN ANALYZE REAL ===");
  try {
    // Buscar um ID de campanha existente para teste real
    const campaigns = await db.query("SELECT id, user_id FROM campaigns LIMIT 1") as any[];
    if (campaigns.length > 0) {
      const { id: campaignId, user_id: userId } = campaigns[0];
      console.log(`Testando campanha real ID: ${campaignId} e User ID: ${userId}`);

      console.log("\nEXPLAIN ANALYZE da subquery de agregação atual:");
      const expCM = await db.query(
        `EXPLAIN ANALYZE SELECT status, COUNT(*) FROM campaign_messages WHERE campaign_id = ? AND user_id = ? GROUP BY status`,
        [campaignId, userId]
      ) as any[];
      console.log(expCM);
    } else {
      console.log("Nenhuma campanha existente no banco para analisar.");
    }
  } catch (err: any) {
    console.error("Erro no EXPLAIN ANALYZE de campanhas:", err.message);
  }

  try {
    const users = await db.query("SELECT id FROM users LIMIT 1") as any[];
    if (users.length > 0) {
      const userId = users[0].id;
      console.log(`\nEXPLAIN ANALYZE de chat_sessions para User ID: ${userId}`);
      const expCS = await db.query(
        `EXPLAIN ANALYZE SELECT COUNT(*) AS cnt FROM chat_sessions WHERE user_id = ? AND status IN ('aguardando', 'pendente') AND closed_at IS NULL`,
        [userId]
      ) as any[];
      console.log(expCS);
    }
  } catch (err: any) {
    console.error("Erro no EXPLAIN ANALYZE de chat_sessions:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
