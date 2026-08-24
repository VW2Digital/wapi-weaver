import fs from 'fs';
import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'wapi_user',
    password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: 'wapi_weaver',
    multipleStatements: true
  });
  
  const sql = fs.readFileSync('database/migrations/033_fix_instagram_accounts_schema.sql', 'utf8');
  await conn.query(sql);
  console.log('Migration executed');
  conn.end();
}
run();
