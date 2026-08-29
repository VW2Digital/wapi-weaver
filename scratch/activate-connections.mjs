import mysql from "mysql2/promise";

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

await c.execute("UPDATE meta_app_connections SET status = 'active' WHERE id = ?", [
  "8536d6d8-fc08-4b60-ba88-386f5aac1335",
]);
await c.execute("UPDATE channel_connections SET status = 'active' WHERE id = ?", [
  "f4c277a7-3e71-408f-abc7-c4938e7a8727",
]);
console.log("ACTIVATED");
await c.end();
