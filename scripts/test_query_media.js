import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'wapi_user',
    password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: 'wapi_weaver'
  });

  const [rows] = await conn.query("SELECT id, contact_phone, direction, type, body, metadata, created_at FROM direct_messages WHERE contact_phone LIKE '%85646076%' ORDER BY created_at ASC");
  console.log('Total messages for contact:', rows.length);
  for (const r of rows) {
    console.log(r.created_at, r.direction, r.type, r.body, JSON.stringify(r.metadata));
  }

  await conn.end();
}

run().catch(console.error);
