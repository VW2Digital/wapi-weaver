import mysql from 'mysql2/promise';
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'wapi_user', password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox', database: 'wapi_weaver'
  });
  try {
    await conn.query("ALTER TABLE instagram_webhook_events DROP FOREIGN KEY fk_instagram_webhook_events_tenant;");
  } catch(e) { console.log("Ignore drop error:", e.message); }
  
  try {
    await conn.query("ALTER TABLE instagram_webhook_events CHANGE tenant_id user_id VARCHAR(36) NOT NULL;");
  } catch(e) { console.log("Ignore change error:", e.message); }
  
  try {
    await conn.query("ALTER TABLE instagram_webhook_events ADD CONSTRAINT fk_instagram_webhook_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;");
  } catch(e) { console.log("Ignore add fk error:", e.message); }
  
  conn.end();
}
run();
