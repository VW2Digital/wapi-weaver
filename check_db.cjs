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
    const q = (sql) => conn.execute(sql);
    const chk = async (label, sql) => {
      const [r] = await conn.execute(sql);
      console.log(label + ':', r.length > 0 ? 'EXISTS' : 'MISSING');
    };
    await chk("kanban_stage_id", "SHOW COLUMNS FROM contacts WHERE Field = 'kanban_stage_id'");
    await chk("is_pinned", "SHOW COLUMNS FROM contacts WHERE Field = 'is_pinned'");
    await chk("is_archived", "SHOW COLUMNS FROM contacts WHERE Field = 'is_archived'");
    await chk("chat_status", "SHOW COLUMNS FROM contacts WHERE Field = 'chat_status'");
    await chk("is_unread", "SHOW COLUMNS FROM contacts WHERE Field = 'is_unread'");
    await chk("opportunities table", "SHOW TABLES LIKE 'opportunities'");
    await chk("opportunity_notes table", "SHOW TABLES LIKE 'opportunity_notes'");
    await chk("sales_stages table", "SHOW TABLES LIKE 'sales_stages'");
    await chk("sales_funnels table", "SHOW TABLES LIKE 'sales_funnels'");
    await chk("opportunity_contacts table", "SHOW TABLES LIKE 'opportunity_contacts'");
    await chk("opportunity_tags table", "SHOW TABLES LIKE 'opportunity_tags'");
    await chk("contact_tags table", "SHOW TABLES LIKE 'contact_tags'");
  } finally {
    await conn.end();
  }
}
check().catch(e => console.error('ERROR:', e.message));
