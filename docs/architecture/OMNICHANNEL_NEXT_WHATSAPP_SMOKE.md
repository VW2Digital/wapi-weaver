# OMNICHANNEL NEXT — WHATSAPP REAL SMOKE TEST DOCUMENT

> Step 11 — Controlled Real Meta Smoke Test with One Message, No Cutover
> This document contains no secrets.

## Purpose

Prove the Omnichannel Next `MetaWhatsAppTransport` can execute:

- one real HTTPS `POST` to `https://graph.facebook.com/{version}/{phoneNumberId}/messages`;
- using the real channel, real credential, and real master key;
- to one controlled test recipient;
- with no queue, no worker, no retry, no cutover;
- returning a `providerMessageId` from Meta if accepted.

## Authorization Scope

Authorized:

- one controlled real WhatsApp Cloud API request;
- one text message;
- no retry.

Not authorized:

- cutover;
- unfreeze;
- queue activation;
- worker activation;
- runtime refactor;
- Instagram;
- multiple sends;
- customer broadcast.

## Components

### `SingleShotMetaHttpClient`

- Implements `HttpClientPort`.
- Built for the Step 11 smoke harness only.
- Validates host allowlist (`graph.facebook.com`).
- Validates exact `/{graphVersion}/{phoneNumberId}/messages` path.
- Validates sender matches resolved channel.
- Validates recipient matches the controlled test number.
- Calls `fetch` exactly once.
- Second `request()` call throws `SINGLE_SHOT_BLOCKED` before network.
- `timeoutMs` with `AbortController`.
- Does not follow redirects.
- Returns a `SingleShotMetaHttpClientResult` with status, `metaAccepted`, `providerMessageId`.
- Redacts `Authorization` and masks `phoneNumberId` and `recipient` in `captured()`.

### `WhatsAppRealDryRun`

Reused from Step 10. Now accepts either `NoNetworkCaptureHttpClient` or `SingleShotMetaHttpClient` as `http`. It sets:

- `networkAttempts` from `http.networkAttempts`;
- `metaRequestsSent` from `http.sentRequests`;
- `realMessagesSent` from `metaRequestsSent` when Meta accepted.

### `scripts/validation/omnichannel-next-whatsapp-real-smoke.ts`

- Manual one-shot script.
- Not auto-executed.
- Requires `--tenant <id> --channel <id> --recipient <number> --execute-real-send`.
- Without `--execute-real-send`, exits with `ARMED_DRY_RUN_ONLY`.
- Generates `correlationId: STEP11_SMOKE_<uuid>`.
- Performs a pre-send dry-run with `NoNetworkCaptureHttpClient`.
- If pre-send passes, arms `SingleShotMetaHttpClient` and performs one real HTTPS request.
- Prints a `SmokeResult` with no token, no ciphertext, no master key, no full phone number, no full recipient.

## Execution

```bash
node --import tsx/esm --env-file=.env scripts/validation/omnichannel-next-whatsapp-real-smoke.ts \
  --tenant <TENANT> \
  --channel <CHANNEL> \
  --recipient <CONTROLLED_TEST_NUMBER> \
  --execute-real-send
```

## Result Contract

```text
correlationId: STEP11_SMOKE_<uuid>
environment: LOCAL | TEST | STAGING | PRODUCTION | UNKNOWN
armed: boolean
controlledRecipient: <masked>
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
captured: { method, host, path, graphVersion, senderNodeType, senderNode: [MASKED], recipient: <masked>, messageType, authorization: Bearer [REDACTED], contentType }
metaHttp: { status, metaAccepted, providerMessageIdPresent, metaErrorCode, metaErrorMessage }
metaAccepted: boolean
deliveryConfirmation: PENDING_MANUAL_CONFIRMATION | CONFIRMED | NOT_APPLICABLE
blockedReason?: string
```

## Safety Levels

```text
BLOCKED
FAILED_BEFORE_NETWORK
META_REJECTED
META_ACCEPTED_PENDING_DELIVERY
DELIVERY_CONFIRMED
```

## Network Rules

- exactly one `POST` to `graph.facebook.com` allowed;
- `attemptedRequests = 1` (or `2` if the kill switch is tested);
- `sentRequests <= 1`;
- `automaticRetries = 0`;
- no `BullMQ`;
- no worker;
- no `direct_messages`, `outbox`, `messaging_events` inserts.

## Database

- `channel_connections` read only.
- `0` harness writes.

## Instagram

- NOT IMPLEMENTED.
- Instagram readiness remains `BLOCKED_API_VARIANT`.
