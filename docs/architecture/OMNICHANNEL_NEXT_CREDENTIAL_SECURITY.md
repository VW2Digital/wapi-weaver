# OMNICHANNEL NEXT — CREDENTIAL SECURITY DOCUMENT

> Step 9 — Secure Credential Vault Adapter for WhatsApp
> Read-only, synthetic material, no real network, no real credentials, freeze active.

## Current Encryption Format Audit

Provenance: `src/lib/encryption.ts` (audited, not imported, not modified).

| Property | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key source | `META_CREDENTIALS_ENCRYPTION_KEY` environment variable |
| Key handling | 64-char hex → 32-byte buffer; otherwise SHA-256 hashed |
| IV length | 12 bytes (24 hex chars) |
| Auth tag length | 16 bytes (32 hex chars) |
| Serialization | `iv:ciphertext:authTag` (all hex-encoded, colon separated) |
| Version marker | None |
| Status | PROVEN |

## Trust Boundaries

```text
UNTRUSTED / NON-SECRET
============================

Application
OutboundJob
Queue
Worker
Provider
CredentialReference

           ↓

SECRET BOUNDARY
============================

MySQLEncryptedCredentialRepository   (ciphertext loader)
AesGcmCredentialDecryptor            (AES-256-GCM)
SecureCredentialVault                (resolver boundary)
WhatsAppCredentialResolver           (provider-locked)
MetaWhatsAppTransport → Authorization: Bearer <token>

           ↓

Meta (only the HTTP request carries the token)

Provider and Application never receive the plaintext token.
```

## Components

### `AesGcmCredentialDecryptor`

- Validates `iv:ciphertext:authTag` shape.
- Authenticated decryption with Node `crypto`.
- Throws `CredentialDecryptionError` on auth tag failure, wrong key, or tampering.
- Never returns plaintext outside `ResolvedSecret`.
- Never imports the current runtime `src/lib/encryption.ts`.

### `MySQLEncryptedCredentialRepository`

- Uses `SELECT` only on `channel_connections`.
- Fetches `access_token_encrypted` by exact `(recordId, tenantId, provider)`.
- Rejects `provider !== "whatsapp"`.
- Tenant and provider validated before returning ciphertext.
- `app_secret_encrypted` and `webhook_verify_token_encrypted` are out of scope.

### `SecureCredentialVault`

- Loads `EncryptedCredentialPayload` from the repository.
- Decrypts through the `CredentialDecryptorPort`.
- Returns `ResolvedSecret` inside the security boundary.

### `WhatsAppCredentialResolver`

- Implements `CredentialResolverPort` used by `MetaWhatsAppTransport`.
- Accepts a JSON-encoded `CredentialReference`.
- Fails closed on:
  - malformed reference
  - `provider !== "whatsapp"`
  - missing record
  - tenant mismatch
- Returns only `{ token }` to the transport; no `kind` exposure.

## Master Key Policy

- The master encryption key is supplied by an `EncryptionKeyProvider`.
- No `process.env` access inside `AesGcmCredentialDecryptor`.
- No key in database, jobs, queue payloads, logs, or serializable configuration.
- Test-only `FixedEncryptionKeyProvider` uses synthetic material.

## Plaintext Lifetime

- Resolved as late as possible.
- Used once per HTTP request.
- Not cached.
- Not persisted.
- Not logged.
- Not returned to Application, Worker, Queue, or Provider.

## JavaScript Memory Limitation

JavaScript cannot guarantee secure erasure of immutable string copies. The architecture
minimizes plaintext lifetime and prohibits persistence, logging, caching, and serialization.
No claim is made that plaintext is "guaranteed erased" from memory.

## Instagram Credential Support

- NOT IMPLEMENTED.
- `WhatsAppCredentialResolver` rejects any `provider !== "whatsapp"`.
- Instagram readiness remains `BLOCKED_API_VARIANT`.

## Test Coverage

- AES-GCM roundtrip with synthetic token.
- Tampered ciphertext → `CredentialDecryptionError`.
- Wrong key → `CredentialDecryptionError`.
- Malformed / missing IV / missing tag → `CredentialFormatError`.
- WhatsApp resolver: provider validation, tenant isolation, exact record lookup.
- Full WhatsApp secure shadow flow: `WhatsAppProvider` → `MetaWhatsAppTransport` → `FakeHttpClient` with `Authorization: Bearer <synthetic>`.
- Zero side effects: no `src/lib/encryption` or `src/lib/token-crypto` imports from `omnichannel-next`.
