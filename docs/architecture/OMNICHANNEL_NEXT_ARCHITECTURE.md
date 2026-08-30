# Omnichannel Next Architecture — Steps 1, 2 and 3

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

## Design Rules

- Provider is always derived from `Channel`, never from the frontend or string heuristics.
- The `SendMessageCommand` does not receive any credentials.
- The service is stateless and tenant-scoped.
- No legacy fallback (`LIMIT 1`, phone prefix, `ig_`, `wa_`).
- No imports from the frozen runtime (`chat.functions.ts`, `chat-outbox.server.ts`, `messaging/outbound/adapters`, `messaging/webhook-handlers`, `messaging/services`, `mysql`, `bullmq`, `ioredis`, `react`).
- New architecture uses in-memory fakes for tests.
- `OutboundJob` carries only domain intent: no access tokens, no Meta payloads.
- `ProviderQueueRouter` has no `default` to any provider; unknown providers fail closed.
- `ProviderWorker` refuses to process a job whose `provider` does not match its own.
- `queued ≠ processing ≠ accepted ≠ delivered`. Accepted only means the provider accepted the request; delivery/read are separate future events.
- Idempotency is enforced by the worker using `MessageRepositoryPort.getById` and `accepted` status.

## Freeze Compliance

Protected runtime files are listed in `.omnichannel-freeze.json`. The guard
`npm run guard:omnichannel` must remain PASS before and after any change to
this new architecture.
