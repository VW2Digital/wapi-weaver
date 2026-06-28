import mysql from "mysql2/promise";

// Cache do pool global para evitar vazamento de conexões no reload (HMR)
const globalForDb = global as unknown as { pool: mysql.Pool };
const pool =
  globalForDb.pool ||
  mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
    waitForConnections: true,
    connectionLimit: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 5,
    queueLimit: 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

/**
 * Executa uma query SQL parametrizada.
 *
 * Tenta `pool.execute()` primeiro (prepared statement).
 * Se falhar com `ER_WRONG_ARGUMENTS` (1210), faz fallback para `pool.query()`.
 * Isso ocorre em statements preparados que usam a mesma variável várias vezes.
 *
 * @param sql  - A sentença SQL com placeholders `?`
 * @param params - Parâmetros opcionais para bind
 * @returns Resultado da query (linhas ou ResultSetHeader)
 */
export async function query(sql: string, params?: unknown[]): Promise<any> {
  try {
    const sanitizedParams = params?.map((p) => (p === undefined ? null : p)) as any;
    const [results] = await pool.execute(sql, sanitizedParams);
    return results;
  } catch (error: unknown) {
    const err = error as { code?: string; errno?: number };
    if (err.code === "ER_WRONG_ARGUMENTS" || err.errno === 1210) {
      const sanitizedParams = params?.map((p) => (p === undefined ? null : p)) as any;
      const [results] = await pool.query(sql, sanitizedParams);
      return results;
    }
    console.error("[DB] Query error:", error);
    console.error("[DB] Failed SQL:", sql);
    console.error("[DB] Params:", params);
    throw error;
  }
}

/**
 * Executa uma série de queries dentro de uma transação.
 *
 * - Obtém uma conexão do pool.
 * - Inicia a transação.
 * - Executa o callback, que recebe a conexão e pode chamar `conn.execute()`.
 * - Se o callback lançar, faz rollback; caso contrário, commit.
 * - Sempre libera a conexão de volta ao pool no `finally`.
 *
 * @param callback - Função que recebe uma conexão e retorna uma Promise com o resultado
 * @returns O valor retornado pelo callback
 */
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
