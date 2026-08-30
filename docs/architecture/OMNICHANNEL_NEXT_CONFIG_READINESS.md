# OMNICHANNEL NEXT — CONFIG READINESS REPORT

> Step 8 — Real Database Read Model
> Read-only. No secret decryption. No real send. No cutover. Freeze active.

## Schema Audited

Tables inspected (from `database/schema/canonical-schema.sql` and migration 034):

- `channel_connections`
  - `id` VARCHAR(36) PK
  - `tenant_id` VARCHAR(36) NOT NULL
  - `meta_app_connection_id` VARCHAR(36) NULL
  - `provider` ENUM('whatsapp','instagram','messenger') NOT NULL
  - `status` ENUM('active','pending','degraded','reauth_required','disconnected') DEFAULT 'pending'
  - `external_account_id` VARCHAR(255) NULL
  - `display_name` VARCHAR(255) NULL
  - `metadata` JSON NULL
  - `access_token_encrypted` TEXT NULL
- `meta_app_connections`
  - `id` VARCHAR(36) PK
  - `tenant_id` VARCHAR(36) NOT NULL
  - `public_id` VARCHAR(64) NOT NULL
  - `app_id` VARCHAR(100) NOT NULL
  - `app_secret_encrypted` TEXT NOT NULL
  - `webhook_verify_token_encrypted` TEXT NOT NULL
  - `graph_version` VARCHAR(20) DEFAULT 'v26.0'
  - `status` ENUM('active','pending','degraded','reauth_required','disconnected') DEFAULT 'pending'

No schema modifications were made.

## Read-Only Layer

Location: `src/lib/omnichannel-next/infrastructure/mysql/read-model/`

- `ReadOnlySqlExecutor` — rejects `INSERT/UPDATE/DELETE/REPLACE/ALTER/DROP/CREATE/TRUNCATE` and multi-statement SQL.
- `MySQLChannelConfigReadRepository` — generic `channel_connections` lookup.
- `MySQLWhatsAppChannelConfigReadRepository` — resolves `phoneNumberId` and `CredentialReference`.
- `MySQLInstagramChannelConfigReadRepository` — discovers `externalAccountId`, optional `pageId` and `igUserId` from `metadata`, but does not pick a sender automatically.
- `MySQLMetaAppReadRepository` — reads `app_id`, `graph_version`, status, and ciphertext presence (no plaintext).
- `MySQLCredentialRecordReadRepository` — verifies ciphertext presence for a `CredentialReference` without returning ciphertext.
- `channel-readiness.ts` — `WhatsApp`/`Instagram` readiness resolvers.

## WhatsApp Readiness

- Channel lookup: exact `(tenantId, channelConnectionId, provider = whatsapp)`.
- `phoneNumberId` mapped from `external_account_id` inside the read-model adapter.
- `credentialReference` points to `channel_connections.id` with `kind = channel-access-token`.
- Cross-tenant and wrong-provider: fail closed.
- Multiple WA channels: each resolved by exact `channelConnectionId`.
- **Readiness**: `CONFIG_READY` (for credential reference; decryption intentionally not performed).

## Instagram Readiness

- Channel lookup: exact `(tenantId, channelConnectionId, provider = instagram)`.
- Discovers `externalAccountId`, `pageId` (from `metadata.page_id`), `igUserId` (from `metadata.ig_user_id`).
- Does **not** fall back to `external_account_id` as sender.
- Does **not** auto-select API variant.
- Credential reference resolvable if `access_token_encrypted` present.
- **Readiness**: `BLOCKED_API_VARIANT` — API variant not yet selected (Step 7 finding preserved).

## Meta App Read Model

- Exact lookup by `(tenantId, metaAppConnectionId)`.
- Cross-tenant isolation enforced.
- Returns `hasAppSecretEncrypted` / `hasWebhookVerifyTokenEncrypted` booleans only.
- No plaintext App Secret or Verify Token returned.

## Credential Record Read Model

- `findByReference` for `channel-access-token` and `meta-app`.
- Verifies `exists` and `ciphertextPresent`.
- Does not decrypt or return ciphertext to application.

## Security Findings

- No new code accesses `META_CREDENTIALS_ENCRYPTION_KEY`.
- No current encryption module imported.
- No real database write performed.
- No real Meta network call.
- No real BullMQ queue or worker.

## Database Writes

0.

## Schema Modifications

0.

## Migrations Created

0.

## Conclusion

- WhatsApp: `CONFIG_READY` — deterministic channel + credential reference resolution in place.
- Instagram: `BLOCKED_API_VARIANT` — remains blocked until the API variant is explicitly chosen.
- Next Step (Step 9) may introduce a dedicated decryption adapter behind `CredentialResolverPort`.
