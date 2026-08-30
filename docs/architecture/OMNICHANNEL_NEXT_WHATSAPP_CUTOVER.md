# OMNICHANNEL NEXT — WHATSAPP CUTOVER

## Goal

Move WhatsApp outbound from the current runtime to the `omnichannel-next` runtime while preserving the current implementation for immediate rollback.

## Authorization

- `UNFREEZE WHATSAPP`: YES (Step 12)
- `UNFREEZE INSTAGRAM`: NO
- `UNFREEZE OMNICHANNEL CORE`: NO

## Pre-cutover baseline

- Freeze guard: PASS
- Golden Path: 8/8 PASS
- Next tests: 151/151 PASS
- Build: PASS
- Typecheck: PASS
- Baseline commit: `17d01f0868589858b045ebe4fdb757fd6a6f7914`

## Runtime switch

```text
WHATSAPP_OUTBOUND_RUNTIME=current  → legacy WhatsApp outbound adapter
WHATSAPP_OUTBOUND_RUNTIME=next     → omnichannel-next adapter
WHATSAPP_OUTBOUND_RUNTIME=<other>  → FAIL CLOSED
```

The switch is server-side, driven by `process.env`, and never exposed to the frontend.

## New files

```text
src/lib/messaging/bridges/sql-executor.types.ts
src/lib/messaging/bridges/real-mysql-executor.ts
src/lib/messaging/bridges/bullmq-whatsapp-queue.ts
src/lib/messaging/bridges/bullmq-whatsapp-worker.ts
src/lib/messaging/bridges/start-whatsapp-next-worker.ts
src/lib/messaging/outbound/runtime-config.ts
src/lib/messaging/outbound/adapters/whatsapp-runtime-adapter.ts
src/lib/omnichannel-next/bridges/whatsapp-next-adapter.ts
src/lib/omnichannel-next/bridges/register-whatsapp-next.ts
src/lib/omnichannel-next/bridges/start-whatsapp-next-worker.ts
src/lib/omnichannel-next/infrastructure/http/fetch-http-client.ts
src/lib/omnichannel-next/infrastructure/security/env-encryption-key-provider.ts
src/lib/omnichannel-next/infrastructure/transaction/no-op-transaction.ts
src/lib/omnichannel-next/infrastructure/mysql/read-model/whatsapp-channel-config-adapter.ts
src/lib/omnichannel-next/infrastructure/bullmq/queue-names.ts
src/lib/omnichannel-next/composition/omnichannel-next.production.container.ts
```

## Modified protected files

```text
src/lib/messaging/outbound/provider-dispatcher.ts
src/lib/messaging/outbound/adapters/whatsapp-runtime-adapter.ts
src/lib/messaging/bridges/bullmq-whatsapp-queue.ts
```

WhatsApp was unfrozen for these changes. Instagram files were not touched.

## Architecture boundary

No frozen-runtime file imports `omnichannel-next`. The `omnichannel-next` bridge is injected into the messaging runtime through a setter in `runtime-config.ts`.

## Queue name

BullMQ queue name is `messaging-outbound-whatsapp` (no colon — BullMQ forbids `:` in queue names).

## Post-cutover real send validation

- Controlled conversation: `9d6fd7b2-40bd-4ded-b3d6-33c4aa0f6e61`
- Tenant: `6da65e93-4864-43c5-b17b-4c3864a49cfc`
- Channel connection: `f4c277a7-3e71-408f-abc7-c4938e7a8727`
- Recipient: `5591985646076`
- Worker log: `[WhatsApp Next Worker] completed <job-id>`
- `direct_messages.status`: `sent`
- `chat_message_outbox.status`: `sent`
- `providerMessageId` returned by Meta

The real WhatsApp Next worker processed the job exactly once. `processChatOutboxBatch` produced exactly one `direct_messages` row and one `chat_message_outbox` row. No waiting BullMQ jobs remained after the send.

## Rollback / re-cutover

- Rollback: stop worker, set `WHATSAPP_OUTBOUND_RUNTIME=current`, run golden-path tests (8/8 PASS).
- Re-cutover: set `WHATSAPP_OUTBOUND_RUNTIME=next`, register `WhatsAppNextOutboundAdapter`, start worker, real send succeeds.

## Negative freeze test

After refreeze, a simulated change to `src/lib/omnichannel-next/bridges/whatsapp-next-adapter.ts` was rejected by `npm run guard:omnichannel`. The probe was reverted and the guard returned to PASS.

## Known limitations

- The real application-level post-cutover send requires a controlled `conversationId` for the configured `tenantId` and `channelConnectionId`, plus an available Redis for the real `messaging-outbound-whatsapp` queue.
- The `NoOpTransaction` is used because the Next `SendMessageService` expects a `TransactionPort`. A real MySQL transaction can be added later without changing the contract.
- Instagram remains `BLOCKED_API_VARIANT` for `omnichannel-next`.

## Final baseline

- Cutover code commit: `da1771272a264973c7cf4fff97b80611fac953b8`
- Refreeze commit: `da1771272a264973c7cf4fff97b80611fac953b8` (baseline updated after final)
