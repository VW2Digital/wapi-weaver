import { CredentialRecordNotFoundError } from "./credential-vault.errors";
import type { CredentialReference } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import type { CredentialDecryptorPort, EncryptedCredentialRepository, ResolvedSecret } from "./credential-vault.types";

export class SecureCredentialVault {
  constructor(
    private readonly repository: EncryptedCredentialRepository,
    private readonly decryptor: CredentialDecryptorPort,
  ) {}

  async resolve(reference: CredentialReference): Promise<ResolvedSecret> {
    const encrypted = await this.repository.find(reference);
    if (!encrypted) {
      throw new CredentialRecordNotFoundError(reference.recordId);
    }

    return this.decryptor.decrypt(encrypted);
  }
}
