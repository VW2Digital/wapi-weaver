import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
});

// Helper to run query and return results
export async function query(sql: string, params?: any[]): Promise<any> {
  try {
    const sanitizedParams = params?.map((p) => (p === undefined ? null : p));
    const [results] = await pool.execute(sql, sanitizedParams);
    return results;
  } catch (error: any) {
    if (error.code === "ER_WRONG_ARGUMENTS" || error.errno === 1210) {
      const sanitizedParams = params?.map((p) => (p === undefined ? null : p));
      const [results] = await pool.query(sql, sanitizedParams);
      return results;
    }
    console.error("Database query error:", error);
    console.error("Failed SQL:", sql);
    console.error("Params:", params);
    throw error;
  }
}

// Transaction wrapper helper
export async function transaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default {
  query,
  transaction,
  pool,
};
