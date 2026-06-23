const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: "root", // let's try root or wapi_user
  password: "", // let's try empty or the password
});

async function main() {
  const credentials = [
    { user: "root", password: "" },
    { user: "root", password: "root" },
    { user: "wapi_user", password: "S0xbxPfKazBVT8JFy1UEOjIsrjox" },
  ];

  let conn;
  for (const cred of credentials) {
    try {
      conn = await mysql.createConnection({
        host: "localhost",
        port: 3306,
        user: cred.user,
        password: cred.password,
      });
      console.log(`Connected with user ${cred.user}`);
      break;
    } catch (e) {
      // ignore
    }
  }

  if (!conn) {
    console.error("Could not connect to MySQL");
    return;
  }

  const [rows] = await conn.execute("SHOW DATABASES");
  console.log("DATABASES:", rows);

  for (const dbRow of rows) {
    const dbName = dbRow.Database || dbRow.database;
    if (["information_schema", "mysql", "performance_schema", "sys"].includes(dbName)) continue;

    await conn.execute(`USE \`${dbName}\``);
    const [tables] = await conn.execute("SHOW TABLES");
    console.log(`Tables in ${dbName}:`, tables);

    // Check campaign count
    try {
      const [countRow] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${dbName}\`.campaigns`);
      console.log(`Campaign count in ${dbName}:`, countRow[0].cnt);
    } catch {
      // no campaigns table
    }
  }

  await conn.end();
}

main().catch(console.error);
