import mysql from "mysql2/promise";

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await c.execute(
  `SELECT id, whatsapp_app_id, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_business_phone, meta_graph_version,
          CASE WHEN whatsapp_app_secret IS NOT NULL AND whatsapp_app_secret != '' THEN 1 ELSE 0 END AS has_secret,
          CASE WHEN whatsapp_access_token IS NOT NULL AND whatsapp_access_token != '' THEN 1 ELSE 0 END AS has_token
   FROM profiles
   WHERE whatsapp_phone_number_id IS NOT NULL
   LIMIT 5`,
);
console.table(rows);
await c.end();
