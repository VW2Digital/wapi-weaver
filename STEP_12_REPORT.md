# PROFESSIONALIZATION STEP 12 — WHATSAPP OMNICHANNEL NEXT CUTOVER

## 1. SCOPE

- Unfreeze WhatsApp outbound for Step 12.
- Cutover WhatsApp outbound to the Omnichannel Next runtime.
- Keep Instagram and the legacy runtime intact for rollback.
- Refreeze after verification.

## 2. EXECUTION CHECKLIST

| Item | Status |
|------|--------|
| ACTUAL_PRE_STEP12_HEAD identified | PASS (`a44471a`) |
| Baseline freeze guard | PASS |
| Golden path tests (current) | 8/8 PASS |
| Next tests | 151/151 PASS |
| Build | PASS |
| Type-check | PASS |
| Redis available for `messaging-outbound-whatsapp` | PASS (`wapi_weaver_redis` on 6379) |
| Controlled conversation ensured | PASS (`9d6fd7b2-40bd-4ded-b3d6-33c4aa0f6e61`) |
| Real WhatsApp Next worker started | PASS |
| `WHATSAPP_OUTBOUND_RUNTIME=next` send | PASS (providerMessageId returned) |
| Queue introspection (0 waiting, 1 completed) | PASS |
| Exactly one direct_message row | PASS |
| Instagram unchanged | PASS (unfreeze not enabled, no Instagram edits) |
| Rollback to `current` | PASS (golden path re-runs with `current`) |
| Re-cutover to `next` | PASS (runtime set to `next`, worker restarted, real send proven) |
| Refreeze / negative freeze test | PASS (guard failed on probe, then passed after revert) |

## 3. REAL POST-CUTOVER SEND RESULT

```json
{
  "status": "CUTOVER_SEND_ATTEMPTED",
  "queued": {
    "messageId": "...",
    "providerMessageId": null,
    "status": "queued",
    "duplicate": false
  },
  "processedCount": 1,
  "conversationId": "9d6fd7b2-40bd-4ded-b3d6-33c4aa0f6e61",
  "clientMessageId": "ed89bb85-21de-4d57-b91f-b809930c8b41",
  "directMessagesCount": 1,
  "directMessageStatus": "sent",
  "chatMessageOutboxCount": 5,
  "providerMessageId": "wami...AA=="
}
```

- Worker log: `[WhatsApp Next Worker] completed 2667e94b-708e-42d1-9036-829fa0be9dc3`
- `direct_messages.wa_message_id` / `provider_message_id` populated.
- `chat_message_outbox.status` = `sent` for the latest outbox row.

## 4. DELIVERY

| Metric | Value |
|--------|-------|
| SENT TO META | YES (HTTP 2xx, providerMessageId returned) |
| QUEUE PROCESSING | 1 completed job, 0 waiting |
| META REQUESTS | 1 (worker processed once) |
| PHONE DELIVERY | CONFIRMED |

> Delivery confirmed by the user for recipient `5591985646076`.

## 5. ROLLBACK / RE-CUTOVER PROOF

- `WHATSAPP_OUTBOUND_RUNTIME` defaults to `current`; golden path tests pass in that mode.
- `WHATSAPP_OUTBOUND_RUNTIME=next` with `registerWhatsAppNextAdapter()` routes to the new adapter.
- The real BullMQ worker was stopped for rollback, then restarted for re-cutover.

## 6. FREEZE STATE

- `.omnichannel-freeze.json` baseline updated to `da1771272a264973c7cf4fff97b80611fac953b8`.
- WhatsApp unfreeze disabled (`unfreeze.whatsapp.enabled = false`).
- New protected paths added for the WhatsApp Next runtime:
  - `src/lib/omnichannel-next/bridges/`
  - `src/lib/messaging/bridges/bullmq-whatsapp-queue.ts`
  - `src/lib/messaging/bridges/bullmq-whatsapp-worker.ts`
- Negative freeze test: guard correctly rejected a probe change to `whatsapp-next-adapter.ts`.

## 7. COMMITS

- `da1771272a264973c7cf4fff97b80611fac953b8` — feat: WhatsApp Next real cutover send with BullMQ worker and idempotent outbox (Step 12)
- `c02f75d...` — freeze: refreeze WhatsApp Next runtime, update baseline and cutover docs

## 8. CONCLUSION

- Implementation, build, tests, guard, real send, delivery, rollback/re-cutover, and refreeze are all verified.
- **STEP 12 = PASS**.
