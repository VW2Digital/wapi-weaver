import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { SqlExecutor } from "../mysql.types";

export class ReadOnlySqlExecutor implements SqlExecutor {
  constructor(private readonly inner: SqlExecutor) {}

  async execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]> {
    this.guard(sql);
    return this.inner.execute<T>(sql, params);
  }

  private guard(sql: string): void {
    const normalized = this.normalize(sql);
    const statements = normalized
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (statements.length > 1) {
      throw new OmnichannelError("READ_ONLY_VIOLATION", "Multiple SQL statements are not allowed in read-only mode");
    }

    const first = statements[0]?.split(/\s+/)[0]?.toUpperCase();
    if (first !== "SELECT" && first !== "WITH") {
      throw new OmnichannelError(
        "READ_ONLY_VIOLATION",
        `Only SELECT and WITH ... SELECT are allowed in read-only mode. Received: ${first ?? "empty"}`,
      );
    }
  }

  private normalize(sql: string): string {
    // Remove block comments /* ... */
    let out = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
    // Remove line comments -- ...
    out = out.replace(/--[^\n\r]*/g, " ");
    return out;
  }
}
