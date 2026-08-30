import { CredentialReferenceMalformedError, CredentialProviderMismatchError } from "./credential-vault.errors";
import { SecureCredentialVault } from "./secure-credential-vault";
import type { CredentialResolverPort, ResolvedCredential as TransportResolvedCredential } from "@/lib/omnichannel-next/infrastructure/http";
import type { CredentialReference } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";

export class WhatsAppCredentialResolver implements CredentialResolverPort {
  constructor(private readonly vault: SecureCredentialVault) {}

  async resolve(reference: string): Promise<TransportResolvedCredential> {
    const ref = this.parse(reference);

    if (ref.provider !== "whatsapp") {
      throw new CredentialProviderMismatchError();
    }

    const resolved = await this.vault.resolve(ref);
    return { token: resolved.token };
  }

  private parse(reference: string): CredentialReference {
    if (!reference || typeof reference !== "string") {
      throw new CredentialReferenceMalformedError();
    }

    try {
      const parsed = JSON.parse(reference) as CredentialReference;
      if (!parsed.kind || !parsed.recordId || !parsed.tenantId || !parsed.provider) {
        throw new CredentialReferenceMalformedError();
      }
      return parsed;
    } catch {
      throw new CredentialReferenceMalformedError();
    }
  }
}
