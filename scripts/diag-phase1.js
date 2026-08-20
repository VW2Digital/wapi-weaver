import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'wapi_user',
    password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: 'wapi_weaver'
  });

  console.log('=== 5. SCHEMA OF direct_messages ===');
  const [cols] = await connection.query('DESCRIBE direct_messages');
  console.table(cols);

  console.log('\n=== PROFILES META CREDENTIALS (MASKED) ===');
  const [profiles] = await connection.query(`
    SELECT id, email, whatsapp_phone_number_id, meta_graph_version, 
           CONCAT(SUBSTRING(whatsapp_access_token, 1, 10), '...', SUBSTRING(whatsapp_access_token, -5)) as masked_token
    FROM profiles 
    WHERE whatsapp_access_token IS NOT NULL AND whatsapp_access_token != ''
    LIMIT 5
  `);
  console.table(profiles);

  await connection.end();
}

run().catch(console.error);
