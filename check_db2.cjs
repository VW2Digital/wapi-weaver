const mysql = require('mysql2/promise');
async function check() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'wapi_user',
    password: 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
    database: 'wapi_weaver',
    port: 3306,
  });
  try {
    // Check users
    const [users] = await conn.execute("SELECT id, email FROM users LIMIT 5");
    console.log("=== USERS ===");
    for (const u of users) console.log(`  ${u.id.slice(0,8)}... | ${u.email}`);

    // Check tables
    const [cols] = await conn.execute("SHOW COLUMNS FROM users");
    console.log("\n=== USERS COLUMNS ===");
    for (const c of cols) console.log(`  ${c.Field} (${c.Type})`);

    // Check contacts (first 5)
    const [contacts] = await conn.execute("SELECT id, user_id, phone_e164, name FROM contacts LIMIT 5");
    console.log("\n=== CONTACTS ===");
    for (const c of contacts) console.log(`  id: ${c.id.slice(0,8)}... | user_id: ${c.user_id.slice(0,8)}... | phone: ${c.phone_e164} | name: ${c.name}`);

    // Try getContactDetail query logic
    if (contacts.length > 0) {
      const contact = contacts[0];
      console.log("\n=== TRYING getContactDetail QUERY ===");
      try {
        const [detail] = await conn.execute(
          `SELECT c.*, ss.name AS kanban_stage_name, ss.color AS kanban_stage_color
           FROM contacts c
           LEFT JOIN sales_stages ss ON ss.id = c.kanban_stage_id AND ss.deleted_at IS NULL
           WHERE c.id = ? AND c.user_id = ? LIMIT 1`,
          [contact.id, contact.user_id]
        );
        if (detail.length > 0) {
          console.log("  QUERY OK: found contact", detail[0].name || "unnamed");
        } else {
          console.log("  QUERY FAILED: contact not found with its own user_id");
        }
      } catch (e) {
        console.log("  SQL ERROR:", e.message);
      }
    }

  } finally {
    await conn.end();
  }
}
check().catch(e => console.error('ERROR:', e.message));
