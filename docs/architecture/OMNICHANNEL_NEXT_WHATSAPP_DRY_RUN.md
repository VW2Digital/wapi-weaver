# OMNICHANNEL NEXT — WHATSAPP REAL DRY RUN DOCUMENT

> Step 10 — Pre-Cutover Validation with Real Config, Real Encrypted Credential, No Network
> This document contains no secrets.

## Purpose

Prove the Omnichannel Next architecture can, with a real WhatsApp channel and real encrypted credential:

1. locate the correct real WhatsApp channel;
2. resolve the correct encrypted credential;
3. decrypt it using the existing infrastructure master key;
4. build the correct WhatsApp Cloud API request;
5. maintain tenant/channel isolation;
6. keep secrets out of application/jobs/logs;
7. stop before any network call.

## Authorization Scope

This step is explicitly authorized for:

- `READ REAL CONFIG`
- `READ REAL ENCRYPTED WHATSAPP CREDENTIAL`
- `USE EXISTING INFRASTRUCTURE MASTER KEY`
- `DECRYPT IN MEMORY`
- `BUILD REAL WHATSAPP REQUEST`

Not authorized:

- real Meta request;
- real message send;
- cutover;
- unfreeze;
- database write;
- credential display.

## Components

### `NoNetworkCaptureHttpClient`

- Validates `Authorization: Bearer <token>`.
- Validates `POST https://graph.facebook.com/{version}/{phoneNumberId}/messages`.
- Redacts `Authorization` to `Bearer [REDACTED]`.
- Never opens a socket, never uses `fetch`, `axios`, or DNS.
- Returns a synthetic `200` with `messages[0].id`.
- Network attempt counter: `1` (capture only, no real request).

### `WhatsAppRealDryRun`

- Receives explicit `tenantId` and `channelConnectionId`.
- Rejects `UNKNOWN` environment.
- Resolves real channel via `MySQLWhatsAppChannelConfigReadRepository` (read-only).
- Resolves real encrypted credential via `MySQLEncryptedCredentialRepository` (read-only).
- Decrypts with `AesGcmCredentialDecryptor` + existing master key.
- Builds the request via `MetaWhatsAppTransport`.
- Captures the redacted descriptor.
- Returns `SafeDryRunResult` with no plaintext.

### `scripts/validation/omnichannel-next-whatsapp-dry-run.ts`

- Manual validation entrypoint.
- Not auto-executed on app start, worker, cron, or route.
- Loads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `META_CREDENTIALS_ENCRYPTION_KEY` from environment.
- Requires explicit `--tenant <id> --channel <id>` arguments.
- Does not log master key, DB password, or decrypted token.
- Outputs only `SafeDryRunResult` JSON.

## Execution

```bash
node --import tsx/esm --env-file=.env scripts/validation/omnichannel-next-whatsapp-dry-run.ts --tenant <TENANT> --channel <CHANNEL>
```

No HTTP route, no UI button, no worker, no cron.

## Result Contract

```text
environment: LOCAL | TEST | STAGING | PRODUCTION | UNKNOWN
realChannelResolved: boolean
realPhoneNumberIdResolved: boolean
realCredentialReferenceResolved: boolean
realEncryptedCredentialFound: boolean
realDecryption: PASS | FAIL | BLOCKED
realCredentialExposed: boolean
whatsappRequestBuilt: boolean
networkAttempts: number
metaRequestsSent: number
realMessagesSent: number
captured: { method, host, path, graphVersion, senderNodeType, senderNode, recipient, messageType, authorization: "Bearer [REDACTED]", contentType }
blockedReason?: string
```

## Possible Blocked Results

- `BLOCKED_ENVIRONMENT_UNRESOLVED`
- `BLOCKED_TARGET_NOT_SPECIFIED`
- `BLOCKED_MASTER_KEY_NOT_AVAILABLE`
- `BLOCKED_NO_REAL_DB`
- `WHATSAPP_CHANNEL_NOT_FOUND`
- `WHATSAPP_PHONE_NUMBER_ID_MISSING`
- `WHATSAPP_CREDENTIAL_MISSING`
- `CREDENTIAL_RECORD_NOT_FOUND`
- `CREDENTIAL_TENANT_MISMATCH`
- `CREDENTIAL_PROVIDER_MISMATCH`
- `CREDENTIAL_FORMAT_ERROR`
- `CREDENTIAL_DECRYPTION_ERROR`
- `DRY_RUN_AUTH_INVALID`
- `DRY_RUN_AUTH_EMPTY`
- `DRY_RUN_ENDPOINT_INVALID`

## Secret Handling

- Plaintext token exists only inside `SecureCredentialVault`, `WhatsAppCredentialResolver`, `MetaWhatsAppTransport`, and `NoNetworkCaptureHttpClient`.
- `SafeDryRunResult` contains `Bearer [REDACTED]` only.
- Console output is the JSON result. No `console.log` of token, ciphertext, key, or DB password.
- `JSON.stringify(result)` does not contain the plaintext token.

## Trust Boundary

```text
UNTRUSTED / NON-SECRET
============================
Validation script arguments
Environment classification
SafeDryRunResult

           ↓

SECRET BOUNDARY
============================
RealMySqlExecutor (read-only SELECT)
MySQLWhatsAppChannelConfigReadRepository
MySQLEncryptedCredentialRepository
AesGcmCredentialDecryptor
SecureCredentialVault
WhatsAppCredentialResolver
MetaWhatsAppTransport
NoNetworkCaptureHttpClient internal token check

           ↓

NO NETWORK
```

## Instagram

- NOT IMPLEMENTED in this step.
- Instagram readiness remains `BLOCKED_API_VARIANT`.

## Database

- `channel_connections` read only.
- `0` writes.
- All SQL passes through `ReadOnlySqlExecutor` semantics.

## Network

- `0` real HTTP requests.
- `0` real Meta requests.
- `0` real messages sent.
