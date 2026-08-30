import { CredentialRecordNotFoundError, CredentialTenantMismatchError, CredentialProviderMismatchError } from "./credential-vault.errors";
import type { SqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql";
import type { CredentialReference } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import type { EncryptedCredentialPayload, EncryptedCredentialRepository } from "./credential-vault.types";

export class MySQLEncryptedCredentialRepository implements EncryptedCredentialRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async find(reference: CredentialReference): Promise<EncryptedCredentialPayload | null> {
    if (reference.provider !== "whatsapp") {
      throw new CredentialProviderMismatchError();
    }

    if (reference.kind === "channel-access-token") {
      const rows = await this.sql.execute<
        { id: string; tenant_id: string; provider: string; access_token_encrypted: string | null }
      >(
        `SELECT id, tenant_id, provider, access_token_encrypted
         FROM channel_connections
         WHERE id = ? AND tenant_id = ? AND provider = ?
         LIMIT 1`,
        [reference.recordId, reference.tenantId, reference.provider],
      );

      const row = rows[0];
      if (!row) {
        throw new CredentialRecordNotFoundError(reference.recordId);
      }

      if (row.tenant_id !== reference.tenantId || row.provider !== reference.provider) {
        throw new CredentialTenantMismatchError();
      }

      if (!row.access_token_encrypted) {
        return null;
      }

      return { reference, ciphertext: row.access_token_encrypted };
    }

    if (reference.kind === "meta-app") {
      const rows = await this.sql.execute<
        { id: string; tenant_id: string; app_secret_encrypted: string | null }
      >(
        `SELECT id, tenant_id, app_secret_encrypted
         FROM meta_app_connections
         WHERE id = ? AND tenant_id = ?
         LIMIT 1`,
        [reference.recordId, reference.tenantId],
      );

      const row = rows[0];
      if (!row) {
        throw new CredentialRecordNotFoundError(reference.recordId);
      }

      if (row.tenant_id !== reference.tenantId) {
        throw new CredentialTenantMismatchError();
      }

      if (!row.app_secret_encrypted) {
        return null;
      }

      return { reference, ciphertext: row.app_secret_encrypted };
    }

    return null;
  }
}
