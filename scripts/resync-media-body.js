/**
 * scripts/resync-media-body.js
 * 
 * Sincroniza e padroniza a coluna `body` em `direct_messages` para mídias recebidas (image, video, document, sticker).
 * Garante que o `body` contenha o texto da legenda ou o placeholder semântico ([Imagem], [Vídeo], [Documento], etc.)
 * enquanto os identificadores de mídia continuam preservados no JSON `metadata`.
 * 
 * Uso:
 *   node scripts/resync-media-body.js --dry-run   (apenas simula e imprime as alterações)
 *   node scripts/resync-media-body.js             (aplica as alterações no banco)
 */

import mysql from 'mysql2/promise';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'wapi_user',
    password: process.env.DB_PASSWORD || 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: process.env.DB_NAME || 'wapi_weaver',
  });

  console.log(`=== SCRIPT DE RESYNC DE MÍDIAS DIRECT_MESSAGES ===`);
  console.log(`Modo: ${isDryRun ? '🔍 DRY-RUN (Somente Leitura / Simulação)' : '⚡ EXECUÇÃO REAL'}\n`);

  const [rows] = await connection.query(`
    SELECT id, tenant_id, user_id, contact_phone, type, body, metadata, raw_payload, created_at
    FROM direct_messages
    WHERE type IN ('image', 'video', 'document', 'sticker', 'audio')
      AND direction = 'incoming'
    ORDER BY created_at DESC
  `);

  console.log(`Total de mensagens de mídia recebidas encontradas: ${rows.length}\n`);

  let changedCount = 0;
  let unchangedCount = 0;

  for (const row of rows) {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const raw = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : (row.raw_payload || {});
    const metaMessage = meta.message || (raw.messages && raw.messages[0]) || {};

    let expectedBody = row.body;

    if (row.type === 'image') {
      const img = metaMessage.image || meta.image || {};
      expectedBody = img.caption || '[Imagem]';
    } else if (row.type === 'audio') {
      expectedBody = '[Áudio]';
    } else if (row.type === 'video') {
      const vid = metaMessage.video || meta.video || {};
      expectedBody = vid.caption || '[Vídeo]';
    } else if (row.type === 'document') {
      const doc = metaMessage.document || meta.document || {};
      expectedBody = doc.filename || doc.caption || '[Documento]';
    } else if (row.type === 'sticker') {
      expectedBody = '[Figurinha]';
    }

    if (row.body !== expectedBody) {
      changedCount++;
      console.log(`[ALTERAÇÃO] ID: ${row.id} | Tipo: ${row.type}`);
      console.log(`   Atual : "${row.body}"`);
      console.log(`   Novo  : "${expectedBody}"\n`);

      if (!isDryRun) {
        await connection.query(
          `UPDATE direct_messages SET body = ? WHERE id = ?`,
          [expectedBody, row.id]
        );
      }
    } else {
      unchangedCount++;
    }
  }

  console.log(`========================================`);
  console.log(`Total analisadas: ${rows.length}`);
  console.log(`Alterações identificadas: ${changedCount}`);
  console.log(`Inalteradas (já corretas): ${unchangedCount}`);
  if (isDryRun) {
    console.log(`\n(Nenhuma alteração foi gravada no banco. Execute sem --dry-run para aplicar.)`);
  } else {
    console.log(`\n(Alterações aplicadas com sucesso no banco de dados.)`);
  }
  console.log(`========================================\n`);

  await connection.end();
}

main().catch(err => {
  console.error('Erro no script de resync:', err);
  process.exit(1);
});
