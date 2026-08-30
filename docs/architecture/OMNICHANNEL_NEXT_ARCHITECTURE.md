# Omnichannel Next Architecture — Steps 1, 2, 3 and 4

## Status

This architecture is **parallel** and **not wired** to the current production runtime.

```text
CURRENT RUNTIME
================
WhatsApp + Instagram — FROZEN — FUNCIONAL — UNCHANGED

NEXT ARCHITECTURE
=================
SendMessageCommand
        ↓
SendMessageService
        ↓
   OutboundJob
        ↓
ProviderQueueRouter
  ┌─────────┴──────────┐
  ↓                    ↓
WhatsApp Queue     Instagram Queue
  ↓                    ↓
WhatsApp Worker    Instagram Worker
  ↓                    ↓
WhatsApp Provider  Instagram Provider

ISOLATED — TESTED — NOT WIRED

```
WhatsApp Next Module
  ├── Provider
  ├── Capability model
  ├── Message mapper
  ├── Channel config port
  └── Transport port

Instagram Next Module
  ├── Provider
  ├── Capability model
  ├── Message mapper
  ├── Channel config port
  └── Transport port
```
```

## Root

```text
src/lib/omnichannel-next/**
```

## Components

### Domain (`src/lib/omnichannel-next/domain/`)

- `provider.ts` — `whatsapp | instagram | messenger`
- `message-types.ts` — canonical `text | image | video | document | audio | sticker`
- `conversation.ts` — `id`, `tenantId`, `channelConnectionId`, `contactId`
- `channel.ts` — `id`, `tenantId`, `provider`, `externalAccountId`, `status`
- `errors.ts` — typed error hierarchy

### Application Commands (`src/lib/omnichannel-next/application/commands/`)

- `send-message.command.ts` — `SendMessageCommand`

### Application Ports (`src/lib/omnichannel-next/application/ports/`)

- `conversation.port.ts`
- `channel.port.ts`
- `message-repository.port.ts`
- `outbound-provider.port.ts`
- `provider-registry.port.ts`
- `transaction.port.ts`

### Application Services (`src/lib/omnichannel-next/application/services/`)

- `send-message.service.ts`
- `send-message.result.ts`

### Provider Modules (`src/lib/omnichannel-next/providers/`)

- `whatsapp/` — `WhatsAppProvider`, capabilities, mapper, ports
- `instagram/` — `InstagramProvider`, capabilities, mapper, ports
- `index.ts` — `NextProviderRegistry`

### Async Outbox (`src/lib/omnichannel-next/application/outbox/`)

- `outbound-job.ts` — canonical job, no credentials, no Meta payloads
- `outbound-job-status.ts` — `pending | queued | processing | accepted | failed`
- `outbound-job.port.ts` — `OutboundJobPort.enqueue`
- `outbound-job.service.ts` — builds an `OutboundJob` from domain context
- `provider-queue.port.ts` — `ProviderQueuePort` for a single provider queue
- `provider-queue-router.ts` — `ProviderQueueRouter`, fail-closed, no `default` to WhatsApp

### Workers (`src/lib/omnichannel-next/application/workers/`)

- `provider-worker.ts` — generic `ProviderWorker` with provider mismatch guard
- `provider-worker.types.ts` — `ProviderWorkerResult`

### Infrastructure (`src/lib/omnichannel-next/infrastructure/`)

- `mysql/` — `MySQLConversationRepository`, `MySQLChannelRepository`, `MySQLMessageRepository`, `MySQLWhatsAppChannelConfigRepository`, `MySQLInstagramChannelConfigRepository`
- `bullmq/` — `BullMQWhatsAppQueue`, `BullMQInstagramQueue`, `queue-names.ts`

## Design Rules

- Provider is always derived from `Channel`, never from the frontend or string heuristics.
- The `SendMessageCommand` does not receive any credentials.
- The service is stateless and tenant-scoped.
- No legacy fallback (`LIMIT 1`, phone prefix, `ig_`, `wa_`).
- No imports from the frozen runtime (`chat.functions.ts`, `chat-outbox.server.ts`, `messaging/outbound/adapters`, `messaging/webhook-handlers`, `messaging/services`, `mysql`, `bullmq`, `ioredis`, `react`).
- New architecture uses in-memory fakes for tests.
- `OutboundJob` carries only domain intent: no access tokens, no Meta payloads.
- `ProviderQueueRouter` has no `default` to any provider; unknown providers fail closed.
### Composition (`src/lib/omnichannel-next/composition/`)

- `create-omnichannel-next.ts` — `createOmnichannelNext(config)` factory
- `create-whatsapp-worker.ts` / `create-instagram-worker.ts` — explicit worker bootstrap factories
- `worker-runtime.ts` — `WorkerRuntime` lifecycle contract
- `omnichannel-next.config.ts` — typed dependency configuration
- `omnichannel-next.container.ts` — `OmnichannelNextContainer` interface
- `noop-transaction.ts` — no-op `TransactionPort` implementation for isolated tests

```text
                     Composition Root
                           │
            ┌──────────────┼──────────────┐
            ↓              ↓              ↓
       Application      Providers     Infrastructure
                            │
                    ┌───────┴───────┐
                    ↓               ↓
               WhatsApp Next   Instagram Next
                    ↓               ↓
            WhatsApp Worker    Instagram Worker
```

### Startup Policy

```text
IMPORT != START
CREATE != START
START MUST BE EXPLICIT
```

The composition root is implemented but not wired to the current runtime.
No worker is started in production.

- `ProviderWorker` refuses to process a job whose `provider` does not match its own.
- `queued ≠ processing ≠ accepted ≠ delivered`. Accepted only means the provider accepted the request; delivery/read are separate future events.
- Idempotency is enforced by the worker using `MessageRepositoryPort.getById` and `accepted` status.
- Dependency direction: `Infrastructure` implements `Application Ports`; `Application` and `Domain` never import `Infrastructure`.
- MySQL adapters receive a `SqlExecutor` by constructor; no global connection or pool.
- BullMQ adapters receive a `Queue` by constructor; no Redis connection on module import.
- All SQL uses parameters; no runtime mutation; no real DB or Redis needed for unit tests.
- `Composition` is the only layer that can wire `Application`, `Infrastructure` and `Providers`.
- `IMPORT != START`, `CREATE != START`, `START` must be explicit.
- Worker runtimes are isolated per provider and are never started on import.

### Meta Transport Contracts (`src/lib/omnichannel-next/infrastructure/meta/`)

Implemented in **shadow/contract mode only** — no real network.

- `HttpClientPort` — generic HTTP client boundary
- `CredentialResolverPort` — secret resolution boundary
- `MetaWhatsAppTransport` — implements `WhatsAppTransportPort`
- `MetaInstagramTransport` — implements `InstagramTransportPort`

WhatsApp contract:
- `POST https://graph.facebook.com/{graphApiVersion}/{phoneNumberId}/messages`
- `Authorization: Bearer <resolved-token>`
- `Content-Type: application/json`
- Body: `{ messaging_product: "whatsapp", recipient_type: "individual", to: <phone>, type: "text", text: { preview_url: false, body: "..." } }`
- Success: `messages[0].id` → `providerMessageId`
- Normalized HTTP error codes for auth/429/5xx

Instagram contract:
- `POST https://graph.instagram.com/{graphApiVersion}/{ig_user_id}/messages`
- `Authorization: Bearer <resolved-token>`
- `Content-Type: application/json`
- Body: `{ recipient: { id: <IGSID> }, message: { text: "..." } }`
- Normal text send does **not** include `HUMAN_AGENT` or `MESSAGE_TAG`
- Success: `message_id` → `providerMessageId`
- Normalized HTTP error codes for auth/429/5xx

Identity semantics:
- Channel canonical identity is **not** used as Graph sender node.
- WhatsApp sender node = `phoneNumberId` from channel config.
- Instagram sender node = `ig_user_id` from channel config.
- Recipient = `ig_scoped_id` / `IGSID` for Instagram; E.164 phone for WhatsApp.
- Credentials are resolved only at the transport boundary.

### Shadow Contract Validation (`tests/jest/omnichannel-next/parity/`)

A read-only, zero-network parity harness compares the current frozen runtime outbound contract with the Omnichannel Next contract.

- `contract-descriptor.ts` — `SafeOutboundContractDescriptor` with provenance.
- `contract-normalizer.ts` — produces `current` and `next` descriptors.
- `contract-diff.ts` — semantic diff with `MATCH | EXPECTED_ARCHITECTURAL_DIFFERENCE | API_VARIANT_DIFFERENCE | INTENTIONAL_IMPROVEMENT | MIGRATION_RISK`.
- Tests prove no real credentials, no real network, and provider isolation.
- Full report: `docs/architecture/OMNICHANNEL_NEXT_PARITY_REPORT.md`.

Current findings:
- **WhatsApp**: `INTENTIONAL_IMPROVEMENT` / `LOW` risk / `SHADOW_READY`.
- **Instagram**: `API_VARIANT_DIFFERENCE` / `HIGH` risk / `BLOCKED` until variant selected.

### Read-Only Configuration Resolution (`src/lib/omnichannel-next/infrastructure/mysql/read-model/`)

Real database tables are read through a `ReadOnlySqlExecutor` that rejects any non-SELECT statement.

- `MySQLWhatsAppChannelConfigReadRepository` resolves `phoneNumberId` and a `CredentialReference` from `channel_connections`.
- `MySQLInstagramChannelConfigReadRepository` discovers identities (`externalAccountId`, optional `pageId`/`igUserId` from `metadata`) without selecting a sender node.
- `MySQLMetaAppReadRepository` reads Meta App metadata without exposing `app_secret_encrypted` or `webhook_verify_token_encrypted`.
- `MySQLCredentialRecordReadRepository` confirms ciphertext presence for a `CredentialReference` without decryption.
- `channel-readiness.ts` produces `CONFIG_READY` for WhatsApp and `BLOCKED_API_VARIANT` for Instagram.

No decryption, no real network, no queue, no worker start.
Full report: `docs/architecture/OMNICHANNEL_NEXT_CONFIG_READINESS.md`.

### Secure Credential Vault (`src/lib/omnichannel-next/infrastructure/security/`)

Real encrypted WhatsApp channel access tokens are decrypted only at the last boundary before the HTTP request.

- `AesGcmCredentialDecryptor` — AES-256-GCM decryptor compatible with the audited current `iv:ciphertext:authTag` format.
- `MySQLEncryptedCredentialRepository` — read-only `SELECT` by exact `(recordId, tenantId, provider='whatsapp')`.
- `SecureCredentialVault` — loads and decrypts inside the secret boundary.
- `WhatsAppCredentialResolver` — validates `provider=whatsapp` and resolves tokens for `MetaWhatsAppTransport` only.
- No import of `src/lib/encryption` or `src/lib/token-crypto` from `omnichannel-next`.
- Plaintext token never flows to Application, OutboundJob, Queue, Worker result, Provider result, MessageRepository, or logs.
- Instagram credential support: NOT IMPLEMENTED.

Full report: `docs/architecture/OMNICHANNEL_NEXT_CREDENTIAL_SECURITY.md`.

### Real WhatsApp Dry-Run Validation (`src/lib/omnichannel-next/infrastructure/validation/`)

With explicit authorization, the Next architecture can validate a real WhatsApp channel and real encrypted credential without sending any network request.

- `NoNetworkCaptureHttpClient` — captures the real request, redacts `Authorization` to `Bearer [REDACTED]`, validates `graph.facebook.com` endpoint, and never opens a socket.
- `WhatsAppRealDryRun` — orchestrates real channel resolution, real credential resolution, real decryption with the existing master key, and real request build, ending at the no-network client.
- `scripts/validation/omnichannel-next-whatsapp-dry-run.ts` — manual entrypoint only; not auto-executed, no route, no worker, no cron.
- Requires explicit `--tenant <id> --channel <id>` and `META_CREDENTIALS_ENCRYPTION_KEY`.
- `0` real HTTP requests, `0` real Meta messages, `0` DB writes.

Full report: `docs/architecture/OMNICHANNEL_NEXT_WHATSAPP_DRY_RUN.md`.

## Freeze Compliance

Protected runtime files are listed in `.omnichannel-freeze.json`. The guard
`npm run guard:omnichannel` must remain PASS before and after any change to
this new architecture.
