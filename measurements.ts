import db from "./src/lib/db";

async function run() {
  console.log("=== MEDIÇÕES REAIS DE DESEMPENHO ===");

  const userId = "acff3186-4e4a-4242-a7a5-3e519265b244"; // ID real do tenant ativo

  // 1. Medir listContacts (antigo comportamento)
  const t0 = performance.now();
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const data: any[] = (await db.query(
      `SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, PAGE, from],
    )) as any[];
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const t1 = performance.now();
  console.log(`Duração do listContacts (completo): ${(t1 - t0).toFixed(2)} ms (Registros carregados: ${all.length})`);

  // 2. Medir getDashboardStats (novo comportamento com countUnreadContacts)
  const t2 = performance.now();
  const now = new Date();
  const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Executar queries do stats
  await db.query(`SELECT COUNT(*) AS cnt FROM contacts WHERE user_id = ? AND created_at <= ?`, [userId, now.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM contacts WHERE user_id = ? AND created_at <= ?`, [userId, sevenAgo.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM templates WHERE user_id = ? AND synced_at <= ?`, [userId, now.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM templates WHERE user_id = ? AND synced_at <= ?`, [userId, sevenAgo.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM campaigns WHERE user_id = ? AND created_at <= ?`, [userId, now.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM campaigns WHERE user_id = ? AND created_at <= ?`, [userId, sevenAgo.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM campaign_messages WHERE user_id = ? AND delivered_at >= ? AND delivered_at < ?`, [userId, sevenAgo.toISOString(), now.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM campaign_messages WHERE user_id = ? AND delivered_at >= ? AND delivered_at < ?`, [userId, new Date(sevenAgo.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), sevenAgo.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM chat_sessions WHERE user_id = ? AND status IN ('aberto') AND closed_at IS NULL`, [userId]);
  await db.query(`SELECT COUNT(*) AS cnt FROM chat_sessions WHERE user_id = ? AND status IN ('aguardando', 'pendente') AND closed_at IS NULL`, [userId]);
  await db.query(`SELECT COUNT(*) AS cnt FROM chat_sessions WHERE user_id = ? AND status = 'fechado' AND closed_at >= ?`, [userId, startOfToday.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM contacts WHERE user_id = ? AND created_at >= ?`, [userId, startOfToday.toISOString()]);
  await db.query(`SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, answered_at)) AS avg_wait FROM chat_sessions WHERE user_id = ? AND started_at >= ? AND answered_at IS NOT NULL`, [userId, startOfToday.toISOString()]);
  await db.query(`SELECT AVG(TIMESTAMPDIFF(SECOND, answered_at, closed_at)) AS avg_conv FROM chat_sessions WHERE user_id = ? AND started_at >= ? AND closed_at IS NOT NULL AND answered_at IS NOT NULL`, [userId, startOfToday.toISOString()]);
  await db.query(`SELECT COUNT(*) AS cnt FROM contacts WHERE user_id = ? AND is_unread = true`, [userId]);
  
  const t3 = performance.now();
  console.log(`Duração do getDashboardStats: ${(t3 - t2).toFixed(2)} ms`);

  // 3. Medir listCampaigns (novo comportamento sem UPDATE na listagem)
  const t4 = performance.now();
  const campaigns: any[] = (await db.query(
    `SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
    [userId],
  )) as any[];

  if (campaigns.length > 0) {
    const campaignIds = campaigns.filter((c) => c.status !== "draft").map((c) => c.id);
    if (campaignIds.length > 0) {
      const placeholders = campaignIds.map(() => "?").join(", ");
      await db.query(
        `SELECT campaign_id, status, COUNT(*) AS cnt 
         FROM campaign_messages 
         WHERE campaign_id IN (${placeholders}) AND user_id = ?
         GROUP BY campaign_id, status`,
        [...campaignIds, userId]
      );
    }
  }
  const t5 = performance.now();
  console.log(`Duração do listCampaigns (novo): ${(t5 - t4).toFixed(2)} ms`);

  // 4. Medir listCampaigns (antigo comportamento com UPDATE para comparação)
  const t6 = performance.now();
  await db.query(
    `UPDATE campaigns c
     SET totals = (
       SELECT JSON_OBJECT(
         'total', COUNT(*),
         'pending', CAST(COALESCE(SUM(status='pending'), 0) AS SIGNED),
         'sending', CAST(COALESCE(SUM(status='sending'), 0) AS SIGNED),
         'sent', CAST(COALESCE(SUM(status='sent'), 0) AS SIGNED),
         'delivered', CAST(COALESCE(SUM(status='delivered'), 0) AS SIGNED),
         'read', CAST(COALESCE(SUM(status='read'), 0) AS SIGNED),
         'failed', CAST(COALESCE(SUM(status='failed'), 0) AS SIGNED)
       ) FROM campaign_messages WHERE campaign_id = c.id AND user_id = ?
     )
     WHERE c.user_id = ? AND c.status != 'draft'`,
     [userId, userId]
  );
  await db.query(`SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`, [userId]);
  const t7 = performance.now();
  console.log(`Duração do listCampaigns (antigo com UPDATE): ${(t7 - t6).toFixed(2)} ms`);

  process.exit(0);
}

run().catch(console.error);
