# P0-B Bot Flow State / Data Integrity Report

## STATUS

**PARTIAL** — `duplicateBotFlow` P0 closed; `bot_conversation_state` P0 blocked because the required migration lives in the protected `database/migrations/` path under the current omnichannel freeze.

## SUBAGENTS

- **A** — Flow Duplication / Graph References
- **B** — Conversation State / Schema / Upserts
- **C** — Concurrency / Idempotency
- **D** — Tests / Non-regression
- **Post-Review** — State Integrity Review
- **Post-Review** — Non-Regression Review

## P0 FROM MATRIX

| Finding | Source | Status |
|---------|--------|--------|
| `duplicateBotFlow` does not remap step UUIDs | `src/lib/botflow.functions.ts:423-449` | **FIXED** |
| `bot_conversation_state` `upsert` `onConflict` mismatch | `src/lib/botflow-executor.server.ts:847-861,945-958` | **BLOCKED** (migration required, protected path) |
| `processBotFlow` tenant/user conflation | `src/lib/botflow-executor.server.ts:299-302,408-423` | **REMAINING** (needs data backfill migration) |
| Direct `processBotFlow` in `whatsapp-webhook.ts` double trigger | `src/routes/api/public/whatsapp-webhook.ts:1149,1731,2123` | **REMAINING** (idempotency/queue change) |

## DUPLICATE FLOW

Implemented a two-pass copy in `duplicateBotFlow`:

1. First pass inserts every step with a new `id` and builds an `oldStepId → newStepId` map.
2. Second pass updates `next_step_id` and recursively rewrites all step UUIDs inside `buttons_config` (`nextStepId`, `trueStepId`, `falseStepId`, `successStepId`, `errorStepId`, `branches[].nextStepId`, `next_step_on_success`, and `step:<id>` interactive targets).

The `remapFlowStepReferences` helper:

- Preserves sentinel values (`-999`, `-998`, `-997`, `0`, ``, `none`).
- Only remaps bare UUIDs inside known step-reference keys (`*StepId`, `next_step_id`, `next_step_on_success`).
- Remaps any `step:<uuid>` string regardless of key.
- Does not touch `handleId` / `sourceHandle` / `sourceHandleId` or arbitrary non-step UUID fields.

`duplicateBotFlowCore` was extracted and exported to allow direct, context-free unit testing.

## UUID REMAP

**PASS** — new test suite verifies:

- new flow and step ids are generated
- `next_step_id` points to the new flow steps
- nested `buttons_config` references are rewritten
- original flow is unchanged
- clone and original are independent after mutation

## ORIGINAL/CLONE ISOLATION

**PASS** — mutating the clone's `buttons_config` does not affect the original.

## BOT STATE IDENTITY

`bot_conversation_state` is currently defined with:

```sql
UNIQUE KEY `uq_bot_conv_state` (`user_id`,`contact_number`,`instance_id`)
```

but the runtime upserts with:

```sql
ON DUPLICATE KEY ... user_id, contact_number, instance_id, channel
```

Because `query-compiler` uses the table's actual unique key, upserts from different channels for the same `(user_id, contact_number, instance_id)` either overwrite each other or fail with a duplicate key error. The correct unique key is:

```sql
UNIQUE KEY `uq_bot_conv_state` (`user_id`,`contact_number`,`instance_id`,`channel`)
```

This fix cannot be committed because `database/migrations/` is in `.omnichannel-freeze.json` protected paths.

## CROSS-CHANNEL ISOLATION

**BLOCKED** — no DB-level channel isolation until the migration is applied.

## UPSERT CONSISTENCY

**BLOCKED** — `dbAdmin.from("bot_conversation_state").upsert(...)` in `processBotFlow` and `executeInactivityStep` still targets a 4-column identity on a 3-column unique key.

## CONCURRENCY / IDEMPOTENCY

Not addressed in this phase because the only safe, minimal fix requires the schema migration above. Retry/double-trigger protection is documented as a remaining P0.

## MIGRATION

**YES — blocked / not committed**

Proposed migration (to be added as `database/migrations/056_fix_bot_conversation_state_unique_key.sql` after `database/migrations/` is unfrozen):

```sql
-- P0-B: isolate bot_conversation_state per channel.

UPDATE `bot_conversation_state`
SET `channel` = 'whatsapp'
WHERE `channel` IS NULL OR `channel` = '';

DELETE t1 FROM `bot_conversation_state` t1
JOIN `bot_conversation_state` t2
  ON t1.user_id = t2.user_id
  AND t1.contact_number = t2.contact_number
  AND t1.channel = t2.channel
  AND (t1.instance_id = t2.instance_id OR (t1.instance_id IS NULL AND t2.instance_id IS NULL))
  AND t1.id <> t2.id
  AND (
    t1.updated_at < t2.updated_at
    OR (t1.updated_at = t2.updated_at AND t1.id < t2.id)
  );

DROP INDEX IF EXISTS `uq_bot_conv_state` ON `bot_conversation_state`;
ALTER TABLE `bot_conversation_state`
  ADD UNIQUE KEY `uq_bot_conv_state` (`user_id`, `contact_number`, `instance_id`, `channel`);
```

Also required after unfreeze:

- Update `database/schema/canonical-schema.sql` and `database/schema/reference-schema.sql` `uq_bot_conv_state` to include `channel`.
- Regenerate `database/schema/schema-contract.json`.

## FILES MODIFIED

- `src/lib/botflow.functions.ts` — two-pass `duplicateBotFlow`, `remapFlowStepReferences`, exported `duplicateBotFlowCore`.
- `jest.config.cjs` — map `@tanstack/react-start` to a Jest mock.
- `tests/__mocks__/react-start.js` — minimal `createMiddleware` / `createServerFn` mock.
- `tests/jest/botflow/botflow-p0b-state-integrity.jest.test.ts` — new P0-B tests.

## TESTS

- `tests/jest/botflow/botflow-p0b-state-integrity.jest.test.ts` (6 passing, 1 todo)
- `npx jest tests/jest/botflow tests/jest/bot-lifecycle.jest.test.ts tests/jest/crm-contact tests/jest/omnichannel-golden-path.jest.test.ts tests/jest/omnichannel-next tests/jest/webchat --runInBand --testTimeout=10000`
  - **53 passed, 53 total**

## REVIEWS

- **State Integrity Review** — `duplicateBotFlow` P0 closed; `bot_conversation_state` P0 blocked pending migration.
- **Non-Regression Review** — PASS; no changed files in `.omnichannel-freeze.json` protected paths; 53 targeted tests pass.

## REMAINING P0

- `bot_conversation_state` unique key migration (blocked by protected `database/migrations/`).
- `processBotFlow` tenant/user conflation (needs data backfill / migration).
- Direct `processBotFlow` calls in `whatsapp-webhook.ts` causing double trigger (needs idempotency/queue).

## FINAL GATES (performed on the non-blocked subset)

```bash
npm run guard:omnichannel  # PASS
npm run type-check          # PASS
npm run build               # PASS (one Vite warning about `crypto` externalization)
npx jest tests/jest/botflow tests/jest/bot-lifecycle.jest.test.ts tests/jest/crm-contact tests/jest/omnichannel-golden-path.jest.test.ts tests/jest/omnichannel-next tests/jest/webchat --runInBand --testTimeout=10000  # 53 PASS
```

## NEXT

**FASE 5 — P1 RUNTIME CONTRACT ALIGNMENT** (only after `database/migrations/` is unfrozen and the `bot_conversation_state` migration is applied).
