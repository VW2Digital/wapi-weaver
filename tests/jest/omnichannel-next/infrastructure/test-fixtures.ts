import type { SqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql";
import type { TransactionPort } from "@/lib/omnichannel-next/application/ports/transaction.port";

export class NoOpTransaction implements TransactionPort {
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export class FakeSqlExecutor implements SqlExecutor {
  queries: { sql: string; params: readonly unknown[] }[] = [];
  private results: Map<string, unknown[]> = new Map();
  private defaults: { pattern: RegExp; result: unknown[] }[] = [];

  addResult<T>(sql: string, result: T[], params?: readonly unknown[]): void {
    this.results.set(this.key(sql, params), result as unknown[]);
  }

  setDefault(pattern: RegExp, result: unknown[]): void {
    this.defaults.push({ pattern, result });
  }

  async execute<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    this.queries.push({ sql, params: params ?? [] });
    const key = this.key(sql, params);
    const result = this.results.get(key);
    if (result !== undefined) return result as T[];

    const normalized = this.normalize(sql);
    for (const def of this.defaults) {
      if (def.pattern.test(normalized)) {
        return def.result as T[];
      }
    }

    return [] as T[];
  }

  private key(sql: string, params?: readonly unknown[]): string {
    const base = this.normalize(sql);
    return params ? `${base}|${JSON.stringify(params)}` : base;
  }

  private normalize(sql: string): string {
    return sql
      .replace(/\s+/g, " ")
      .replace(/\( /g, "(")
      .replace(/ \)/g, ")")
      .trim();
  }
}

export class FakeBullMQQueue {
  calls: { name: string; data: unknown; opts?: { jobId?: string } }[] = [];
  shouldThrow = false;

  async add(
    name: string,
    data: unknown,
    opts?: { jobId?: string },
  ): Promise<unknown> {
    if (this.shouldThrow) throw new Error("BullMQ add failed");
    this.calls.push({ name, data, opts });
    return { id: opts?.jobId ?? "job-id" };
  }
}
