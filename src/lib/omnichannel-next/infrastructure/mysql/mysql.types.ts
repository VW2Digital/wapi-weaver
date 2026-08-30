export interface SqlExecutor {
  execute<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}
