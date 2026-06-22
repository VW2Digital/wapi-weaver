import mysql from 'mysql2/promise';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  try {
    const [rows] = await pool.execute('DESCRIBE profiles');
    console.log('Columns in profiles:');
    console.log(rows.map(r => r.Field).join(', '));
  } catch (err) {
    console.error('Error describing profiles table:', err);
  } finally {
    await pool.end();
  }
}

main();
