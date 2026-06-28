import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "wapi_weaver",
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    const [funnels] = await connection.query("SELECT * FROM sales_funnels");
    console.log("FUNNELS:", funnels);

    const [stages] = await connection.query("SELECT id, name, funnel_id, user_id FROM sales_stages");
    console.log("STAGES:", stages);

    const [contacts] = await connection.query("SELECT id, name, kanban_stage_id, user_id FROM contacts LIMIT 10");
    console.log("CONTACTS:", contacts);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await connection.end();
  }
}

run();
