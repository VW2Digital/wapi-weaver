import mysql from "mysql2/promise";
import type { SqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql";

export interface RealMySqlExecutorOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class RealMySqlExecutor implements SqlExecutor {
  private readonly pool: mysql.Pool;

  constructor(options: RealMySqlExecutorOptions) {
    this.pool = mysql.createPool({
      ...options,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
    });
  }

  async execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params as any);
    return rows as T[];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
