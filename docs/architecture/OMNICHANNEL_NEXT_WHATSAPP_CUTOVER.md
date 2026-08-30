# OMNICHANNEL NEXT — WHATSAPP CUTOVER

## Goal

Move WhatsApp outbound from the current runtime to the `omnichannel-next` runtime while preserving the current implementation for immediate rollback.

## Authorization

- `UNFREEZE WHATSAPP`: YES
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
src/lib/messaging/outbound/runtime-config.ts
src/lib/messaging/outbound/adapters/whatsapp-runtime-adapter.ts
src/lib/omnichannel-next/bridges/whatsapp-next-adapter.ts
src/lib/omnichannel-next/bridges/register-whatsapp-next.ts
src/lib/omnichannel-next/infrastructure/http/fetch-http-client.ts
src/lib/omnichannel-next/infrastructure/security/env-encryption-key-provider.ts
src/lib/omnichannel-next/infrastructure/transaction/no-op-transaction.ts
src/lib/omnichannel-next/infrastructure/mysql/read-model/whatsapp-channel-config-adapter.ts
src/lib/omnichannel-next/composition/omnichannel-next.production.container.ts
```

## Modified protected files

```text
src/lib/messaging/outbound/provider-dispatcher.ts
src/lib/messaging/outbound/adapters/whatsapp-runtime-adapter.ts
```

WhatsApp was unfrozen for these changes. Instagram files were not touched.

## Architecture boundary

No frozen-runtime file imports `omnichannel-next`. The `omnichannel-next` bridge is injected into the messaging runtime through a setter in `runtime-config.ts`.

## Rollback runbook

1. Stop any running WhatsApp Next worker consumer.
2. Set `WHATSAPP_OUTBOUND_RUNTIME=current`.
3. Restart/reload the server process if required.
4. Quarantine pending Next jobs in `messaging:outbound:whatsapp`.
5. Verify current WhatsApp send works.
6. Verify Instagram is unaffected.
7. Investigate before re-enabling `next`.

## Known limitations

- The real application-level post-cutover send requires a controlled `conversationId` for the configured `tenantId` and `channelConnectionId`, plus an available Redis for the real `messaging:outbound:whatsapp` queue.
- The `NoOpTransaction` is used because the Next `SendMessageService` expects a `TransactionPort`. A real MySQL transaction can be added later without changing the contract.
- Instagram remains `BLOCKED_API_VARIANT` for `omnichannel-next`.
