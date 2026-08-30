import type { EncryptionKeyProvider } from "./credential-vault.types";

export class LiteralEncryptionKeyProvider implements EncryptionKeyProvider {
  constructor(private readonly key: Buffer) {}

  getKey(): Buffer {
    return this.key;
  }
}
