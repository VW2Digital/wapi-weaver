export interface TransactionPort {
  run<T>(fn: () => Promise<T>): Promise<T>;
}
