import db from './src/lib/db'; 

async function run() {
  const rows = await db.query("SELECT id, title, value FROM opportunities LIMIT 1") as any[];
  if (!rows || rows.length === 0) {
    console.log("Nenhuma oportunidade encontrada. Criando uma...");
    const userIdRes = await db.query("SELECT id FROM users LIMIT 1") as any[];
    if (userIdRes.length === 0) {
      console.log("Nenhum usuario encontrado");
      process.exit(1);
    }
    const userId = userIdRes[0].id;

    const funnelRes = await db.query("SELECT id FROM sales_funnels WHERE user_id = ? LIMIT 1", [userId]) as any[];
    if (funnelRes.length === 0) {
      console.log("Nenhum funil encontrado para o usuario", userId);
      process.exit(1);
    }
    const funnelId = funnelRes[0].id;

    const stageRes = await db.query("SELECT id FROM sales_stages WHERE funnel_id = ? LIMIT 1", [funnelId]) as any[];
    if (stageRes.length === 0) {
      console.log("Nenhuma etapa encontrada");
      process.exit(1);
    }
    const stageId = stageRes[0].id;

    const newId = crypto.randomUUID();
    await db.query(`INSERT INTO opportunities (id, user_id, funnel_id, stage_id, title, value, status, kanban_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
      [newId, userId, funnelId, stageId, "Nova Oportunidade Teste", 100.0, "open", 1]);
    
    console.log("Criado opp:", newId);
    process.exit(0);
  }
  
  const opp = rows[0];
  console.log("Antes:", opp);

  const novoTitulo = "Oportunidade E2E Editada";
  const novoValor = 9999.99;

  await db.query("UPDATE opportunities SET title = ?, value = ? WHERE id = ?", [novoTitulo, novoValor, opp.id]);
  
  const updated = await db.query("SELECT id, title, value FROM opportunities WHERE id = ?", [opp.id]) as any[];
  console.log("Depois:", updated[0]);
  process.exit(0);
}

run().catch(console.error);
