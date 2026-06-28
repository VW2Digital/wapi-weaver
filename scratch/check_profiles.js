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
    const [profiles] = await connection.query("SELECT id, email, whatsapp_phone_number_id, whatsapp_access_token FROM profiles");
    console.log("PROFILES:", profiles);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await connection.end();
  }
}

run();
