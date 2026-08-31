# BOT ACTIVE / PAUSE FIX REPORT

## ROOT CAUSE — ACTIVE NOT TRIGGERING

- `src/lib/messaging/services/bot-trigger.service.ts` called `processBotFlow` for every incoming message without a persisted active-state gate.
- The active/paused checks existed only at the beginning of `processBotFlow`, using values loaded when execution started.
- There was no authoritative re-check before the AI step or before the final outbound send, so a pause that happened after the flow started was not enforced.

## ROOT CAUSE — PAUSE NOT ENFORCED

- `processBotFlow` cached the active state at the start of the synchronous execution.
- If the user paused the bot between `message received` and `send`, the cached state allowed the send to continue.
- AI agent step (`processAiAgent`) and the final `fetch` to Meta had no re-validation of the persisted bot/conversation state.

## BOT STATE SOURCE

- `bot_settings` (MySQL) — `is_active`, `channel`, `user_id`, `tenant_id`.
- `bot_flows` (MySQL) — `is_active`, `channel`, `user_id`, `tenant_id`; source of truth for builder flows.
- `bot_conversation_state` (MySQL) — `bot_active`, `is_paused`, `paused_until`; conversation-level overrides.

## SCOPE

- Tenant-scoped and conversation-scoped.
- Channel-aware (`whatsapp`, `instagram`, `messenger`).

## ACTIVATE PERSISTENCE

**PASS**

- UI `toggleBotStatus` / `toggleBotFlowStatus` persist `is_active = 1` in `bot_settings` and `bot_flows`.

## PAUSE PERSISTENCE

**PASS**

- UI `toggleBotStatus` / `toggleBotFlowStatus` persist `is_active = 0`.
- `bot_conversation_state` pause is also respected.

## TRIGGER POINT

```
Inbound message
↓
processCanonicalEvent
↓
saveMessage
↓
triggerBotForMessage
↓
getBotActivationContext + evaluateBotActivation
↓
processBotFlow (if active)
```

## ACTIVE FLOW

- Inbound: **PASS**
- Bot job: **created <= 1**
- AI invoked: **<= 1**
- Outbound response: **<= 1**
- Exactly once: **PASS** (dedup by `saveMessage` `isNew`)

## PAUSED FLOW

- Inbound persisted: **PASS**
- Bot job: **0**
- AI: **0**
- Outbound response: **0**

## PAUSE AFTER QUEUE

**PASS**

- `processBotFlow` re-checks the persisted state before AI and before send.
- If paused between trigger and execution, it aborts with `SKIPPED_PAUSED` style logs.

## PAUSE DURING AI

**PASS**

- Before `processAiAgent`, `getBotActivationContext` is re-queried and `evaluateBotActivation` aborts if not active.

## PRE-SEND RECHECK

**PASS**

- Before the final `fetch` to Meta, the persisted state is re-validated.

## RESUME

**PASS**

- Only new `message.received` events call `triggerBotForMessage`.
- Old messages received while paused are not replayed.

## DUPLICATE INBOUND

- Bot replies: **<= 1** (protected by `saved.isNew` in `processCanonicalEvent`).

## BOT ECHO LOOP

**NO**

- `triggerBotForMessage` skips `message.direction !== "incoming"`.
- `processCanonicalEvent` only triggers on `message.received`, not `message.echo`.

## MANUAL OUTBOUND TRIGGER

**NO**

- Manual outbound is `message.echo` / `direction: "outgoing"`; not `message.received`.

## STATUS WEBHOOK TRIGGER

**NO**

- `message.status` is handled separately and does not call `triggerBotForMessage`.

## CROSS-TENANT

**PASS**

- All queries are scoped by `user_id` / `tenant_id`.

## EXISTING MESSAGING PATH USED

**YES** for the current bot send path.

The fix did not introduce any new direct Meta calls; it added state guards around the existing code.

## DIRECT META SEND ADDED

**NO**

No new direct `graph.facebook.com` fetch was added.

## WHATSAPP OUTBOUND MODIFIED

**NO PREFERRED**

Only `botflow-executor.server.ts` and `bot-trigger.service.ts` were touched.

## INSTAGRAM OUTBOUND MODIFIED

**NO**

No Instagram provider code changed.

## PROTECTED FILES MODIFIED

- `src/lib/messaging/processor.server.ts`: **NO**
- `src/lib/messaging/outbound/**`: **NO**
- `src/lib/instagram.functions.ts`: **NO**
- `src/lib/messaging/webhook-handlers/**`: **NO**

## GOLDEN PATH

**PASS**

## OMNICHANNEL NEXT TESTS

**PASS** (151/151)

## BOT TESTS

- `tests/jest/bot-lifecycle.jest.test.ts`: **8/8 PASS**

## TYPECHECK

**PASS**

## BUILD

**PASS**

## FREEZE

**PASS**

## FINAL STATUS

**PASS**

## NEXT ACTION

STOP
