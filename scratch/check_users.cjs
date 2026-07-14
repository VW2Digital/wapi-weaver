const fs = require("fs");
const mysql = require("mysql2/promise");

async function main() {
  let dbConfig = {
    host: "localhost",
    port: 3306,
    user: "wapi_user",
    password: "",
    database: "wapi_weaver",
  };

  try {
    if (fs.existsSync(".env")) {
      const envContent = fs.readFileSync(".env", "utf-8");
      const hostMatch = envContent.match(/DB_HOST=["']?([^"'\s]+)["']?/);
      const portMatch = envContent.match(/DB_PORT=["']?([^"'\s]+)["']?/);
      const userMatch = envContent.match(/DB_USER=["']?([^"'\s]+)["']?/);
      const passMatch = envContent.match(/DB_PASSWORD=["']?([^"'\s]+)["']?/);
      const nameMatch = envContent.match(/DB_NAME=["']?([^"'\s]+)["']?/);

      if (hostMatch) dbConfig.host = hostMatch[1];
      if (portMatch) dbConfig.port = parseInt(portMatch[1], 10);
      if (userMatch) dbConfig.user = userMatch[1];
      if (passMatch) dbConfig.password = passMatch[1];
      if (nameMatch) dbConfig.database = nameMatch[1];
    }
  } catch (err) {
    console.warn("Could not read .env file, using default DB configuration.");
  }

  console.log("Connecting to:", dbConfig.host, dbConfig.database);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [users] = await connection.query("SELECT id, email, created_at FROM users");
    console.log("Registered Users:", users);
    
    const [roles] = await connection.query("SELECT * FROM user_roles");
    console.log("User Roles:", roles);
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    if (connection) await connection.end();
  }
}

main();
