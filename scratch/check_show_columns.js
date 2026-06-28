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
    const [columns] = await connection.query("SHOW COLUMNS FROM `contacts` LIKE 'channel'");
    console.log("COLUMNS TYPE:", typeof columns, Array.isArray(columns));
    console.log("COLUMNS VALUE:", columns);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await connection.end();
  }
}

run();
