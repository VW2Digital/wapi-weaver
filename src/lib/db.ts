"use server";
import mysql from "mysql2/promise";

// ─── Pool Singleton via globalThis ────────────────────────────────────────────
// Usar globalThis garante que o pool é criado UMA VEZ mesmo com HMR do Vite,
// evitando o acúmulo de pools zumbis a cada reload de módulo.
const globalForDb = globalThis as unknown as { pool?: mysql.Pool };

if (!globalForDb.pool && typeof mysql.createPool === "function") {
  globalForDb.pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "wapi_weaver",
    waitForConnections: true,
    // 10 conexões ativas + fila de 100 requests aguardando — suficiente para
    // suportar HMR, workers e queries simultâneas sem estourar o MySQL.
    connectionLimit: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 10,
    queueLimit: 100,
    multipleStatements: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    // Libera conexões ociosas após 60 s para evitar acúmulo no MySQL
    idleTimeout: 60000,
  });
}

const pool = globalForDb.pool!;

// ─── Constantes de retry ───────────────────────────────────────────────────────
const RETRYABLE_CODES = new Set([
  1040,  // ER_CON_COUNT_ERROR — Too many connections
  1213,  // ER_LOCK_DEADLOCK   — Deadlock found
  1205,  // ER_LOCK_WAIT_TIMEOUT
]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

function isRetryable(err: unknown): boolean {
  const e = err as { errno?: number; code?: string };
  return (
    RETRYABLE_CODES.has(e.errno ?? 0) ||
    e.code === "ECONNREFUSED" ||
    e.code === "PROTOCOL_CONNECTION_LOST"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa uma query SQL parametrizada com retry automático.
 *
 * - Tenta `pool.execute()` primeiro (prepared statement).
 * - Se falhar com `ER_WRONG_ARGUMENTS` (1210), faz fallback para `pool.query()`.
 * - Em erros transitórios (Too many connections, deadlock, ECONNREFUSED),
 *   aguarda com backoff exponencial e tenta novamente até MAX_RETRIES vezes.
 *
 * @param sql    - A sentença SQL com placeholders `?`
 * @param params - Parâmetros opcionais para bind
 * @returns Resultado da query (linhas ou ResultSetHeader)
 */
export async function query<T = any>(sql: string, params?: unknown[]): Promise<T> {
  const sanitizedParams = params?.map((p) => (p === undefined ? null : p)) as any;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      try {
        const [results] = await pool.execute(sql, sanitizedParams);
        return results as T;
      } catch (execError: unknown) {
        // Fallback para pool.query() em caso de ER_WRONG_ARGUMENTS ou similar
        const [results] = await pool.query(sql, sanitizedParams);
        return results as T;
      }
    } catch (error: unknown) {
      const isLast = attempt === MAX_RETRIES;

      if (isRetryable(error) && !isLast) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt); // 200ms, 400ms, 800ms
        console.warn(
          `[DB] Erro transitório na tentativa ${attempt + 1}/${MAX_RETRIES + 1}. Aguardando ${delay}ms... Erro: ${(error as any)?.message}`,
        );
        await sleep(delay);
        continue;
      }

      console.error("[DB] Query error (não retryable ou esgotado):", error);
      console.error("[DB] Failed SQL:", sql);
      console.error("[DB] Params:", params);
      throw error;
    }
  }

  // Nunca alcançado, mas necessário para TypeScript
  throw new Error("[DB] Esgotadas todas as tentativas de retry.");
}

/**
 * Executa uma série de queries dentro de uma transação atômica.
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

export interface DbInterface {
  query: typeof query;
  transaction: typeof transaction;
  pool: mysql.Pool;
}

const db: DbInterface = {
  query,
  transaction,
  pool,
};

export default db;
