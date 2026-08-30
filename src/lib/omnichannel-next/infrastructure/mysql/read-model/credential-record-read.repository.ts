import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { SqlExecutor } from "../mysql.types";
import type { CredentialReference, EncryptedCredentialRecord } from "./read-model.types";

export class MySQLCredentialRecordReadRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByReference(reference: CredentialReference): Promise<EncryptedCredentialRecord> {
    if (reference.kind === "channel-access-token") {
      const rows = await this.sql.execute<
        { id: string; access_token_encrypted: string | null; tenant_id: string; provider: string }
      >(
        `SELECT id, access_token_encrypted, tenant_id, provider
         FROM channel_connections
         WHERE id = ? AND tenant_id = ? AND provider = ?
         LIMIT 1`,
        [reference.recordId, reference.tenantId, reference.provider],
      );

      const row = rows[0];
      return {
        reference,
        exists: Boolean(row),
        ciphertextPresent: Boolean(row?.access_token_encrypted),
      };
    }

    if (reference.kind === "meta-app") {
      const rows = await this.sql.execute<
        { id: string; app_secret_encrypted: string | null; tenant_id: string }
      >(
        `SELECT id, app_secret_encrypted, tenant_id
         FROM meta_app_connections
         WHERE id = ? AND tenant_id = ?
         LIMIT 1`,
        [reference.recordId, reference.tenantId],
      );

      const row = rows[0];
      return {
        reference,
        exists: Boolean(row),
        ciphertextPresent: Boolean(row?.app_secret_encrypted),
      };
    }

    throw new OmnichannelError(
      "UNKNOWN_CREDENTIAL_KIND",
      `Unknown credential kind: ${(reference as any).kind}`,
    );
  }
}
