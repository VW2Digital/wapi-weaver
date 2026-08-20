import mysql from 'mysql2/promise';

async function run() {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'wapi_user',
    password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: 'wapi_weaver'
  });

  console.log('=== SHOW CREATE TABLE direct_messages ===');
  const [res] = await c.query('SHOW CREATE TABLE direct_messages');
  console.log(res[0]['Create Table']);

  console.log('\n=== ALL PROFILES WITH META CONFIG ===');
  const [p] = await c.query(`
    SELECT id, full_name, whatsapp_phone_number_id, meta_graph_version,
           IF(whatsapp_access_token IS NOT NULL AND LENGTH(whatsapp_access_token) > 0, 
              CONCAT(SUBSTRING(whatsapp_access_token, 1, 10), '...', SUBSTRING(whatsapp_access_token, -5)), 
              'NULL') as masked_token
    FROM profiles
  `);
  console.table(p);

  console.log('\n=== LAST 5 MESSAGES IN DATABASE ===');
  const [msgs] = await c.query(`
    SELECT id, tenant_id, user_id, contact_phone, direction, type, body, wa_message_id, status, created_at
    FROM direct_messages
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.table(msgs);

  await c.end();
}

run().catch(console.error);
