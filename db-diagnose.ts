import db from "./src/lib/db";

async function run() {
  console.log("=== DIAGNÓSTICO DO BANCO DE DADOS ===");

  // 1. Mostrar índices das tabelas envolvidas
  for (const table of ["chat_sessions", "campaign_messages", "contacts"]) {
    console.log(`\nÍndices da tabela: ${table}`);
    const indexes = await db.query(`SHOW INDEX FROM \`${table}\``) as any[];
    console.table(indexes.map(idx => ({
      Key_name: idx.Key_name,
      Column_name: idx.Column_name,
      Seq_in_index: idx.Seq_in_index,
      Non_unique: idx.Non_unique,
    })));
  }

  // 2. SQLs e EXPLAIN de consultas no dashboard
  const sampleUserId = "dummy-user-id"; // substitua se necessário
  console.log("\n=== EXPLAIN DAS CONSULTAS LENTAS ===");

  // Explains do chat_sessions
  console.log("\nQuery: COUNT(*) chat_sessions por status");
  try {
    const explainChat = await db.query(
      `EXPLAIN SELECT COUNT(*) AS cnt FROM chat_sessions WHERE user_id = ? AND status IN ('aguardando', 'pendente') AND closed_at IS NULL`,
      [sampleUserId]
    );
    console.table(explainChat);
  } catch (err: any) {
    console.error(err.message);
  }

  // Explains do campaign_messages
  console.log("\nQuery: UPDATE campaigns c (Subquery de agregação)");
  try {
    const explainUpdateSubquery = await db.query(
      `EXPLAIN SELECT COUNT(*), SUM(status='pending'), SUM(status='sent') FROM campaign_messages WHERE campaign_id = 'some-id' AND user_id = ?`,
      [sampleUserId]
    );
    console.table(explainUpdateSubquery);
  } catch (err: any) {
    console.error(err.message);
  }

  // 3. Comparação Semântica de Contatos
  console.log("\n=== COMPARAÇÃO DE CONTATOS ===");
  try {
    // Pegar o primeiro user_id real para testar
    const users = await db.query("SELECT id FROM users LIMIT 1") as any[];
    if (users.length > 0) {
      const realUserId = users[0].id;
      
      const countRes = await db.query(
        "SELECT COUNT(*) AS cnt FROM contacts WHERE user_id = ?",
        [realUserId]
      ) as any[];
      const totalCount = countRes[0].cnt;

      const listRes = await db.query(
        "SELECT id FROM contacts WHERE user_id = ?",
        [realUserId]
      ) as any[];
      const totalList = listRes.length;

      console.log(`Para o usuário real ID ${realUserId}:`);
      console.log(`- COUNT(*) no Banco: ${totalCount}`);
      console.log(`- listContacts length: ${totalList}`);
      console.log(`- São equivalentes? ${totalCount === totalList ? "SIM" : "NÃO"}`);
    } else {
      console.log("Nenhum usuário encontrado no banco para realizar a comparação de contatos.");
    }
  } catch (err: any) {
    console.error("Erro na comparação de contatos:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
