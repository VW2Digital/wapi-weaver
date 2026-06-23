const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
});

async function main() {
  const [rows] = await pool.execute("SELECT id, name, language, components, status FROM templates");
  console.log("TEMPLATES:");
  for (const row of rows) {
    console.log("-----------------------------------------");
    console.log("ID:", row.id);
    console.log("NAME:", row.name);
    console.log("LANGUAGE:", row.language);
    console.log("STATUS:", row.status);
    console.log("COMPONENTS:");
    try {
      const comps = typeof row.components === "string" ? JSON.parse(row.components) : row.components;
      console.log(JSON.stringify(comps, null, 2));
    } catch {
      console.log(row.components);
    }
  }
  await pool.end();
}

main().catch(console.error);
