import type { TransactionPort } from "@/lib/omnichannel-next/application/ports/transaction.port";

export class NoOpTransaction implements TransactionPort {
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}
