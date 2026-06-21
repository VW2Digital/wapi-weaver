import db from "./src/lib/db";

async function check() {
  try {
    const [users] = await db.query("SELECT id, email FROM users");
    console.log("Users:", users);
    const [rows] = await db.query("SHOW TABLES LIKE 'webhook_events'");
    console.log("Webhook tables found:", rows);

    const [data] = await db.query("SELECT * FROM webhook_events LIMIT 5");
    console.log("Recent data:", data);

    const [columns] = await db.query("SHOW COLUMNS FROM webhook_events");
    console.log("Columns:", columns);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}

check();
