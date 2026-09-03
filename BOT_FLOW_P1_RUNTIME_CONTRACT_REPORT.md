# Bot Flow Builder — FASE 5 P1 Runtime Contract Alignment Report

## STATUS

**P1 PASS with known remaining items.**

All P0 gates remain green. The central P1 contract gaps were closed:

- `condition_operator` phantom field removed from the save contract.
- Condition rules (`greater_than`, `is_true`, `is_false`, `before`, `after`) execute consistently in legacy and typed paths.
- Condition / `save_variable` `buttons_config` survives save → load → runtime.
- `next_step_id` and `LeadFieldReference` roundtrip correctly through `bot_steps`.
- Unknown and partial (`product`, `whatsapp_flow`, `location`, `create_chat`) message types fail controlled in `processBotFlow` and `executeInactivityStep`.
- `MAX_CONTROL_HOPS` is shared between `processBotFlow` and `executeInactivityStep`; loop over-run now terminates the flow instead of dispatching a control node.

## SUBAGENTS

| Subagent | Area | Verdict |
|---|---|---|
| A — Editor / StepInspector / Serialization | `src/components/bot-flow/*`, `src/lib/botflow.functions.ts` | Inputs consolidated |
| B — Persistence / Save-Load Contracts | `src/lib/botflow.functions.ts`, `database/schema/*` | Inputs consolidated |
| C — Runtime / processBotFlow | `src/lib/botflow-executor.server.ts`, `src/lib/botflow-control.ts`, `src/lib/bot-registry.ts` | Inputs consolidated |
| D — Tests / Non-regression | `tests/jest/botflow/*`, `src/lib/botflow-executor.server.ts` | Inputs consolidated |
| E — Contract Reviewer (post-impl) | Full contract trace | PASS after fixes |
| F — Non-regression Reviewer (post-impl) | Runtime / lifecycle / channel dispatch | PASS after fixes |

## CONTRACT MISMATCHES FOUND

| # | Mismatch | Fix | Status |
|---|---|---|---|
| 1 | `condition_operator` accepted by `saveBotStepInput` / `saveBotStepsBatchInput` but not persisted (no column, no payload). | Removed `condition_operator` from the Zod schemas. | **FIXED** |
| 2 | Legacy `evaluateCondition` did not support `is_true`, `is_false`, `before`, `after`; numeric operators used `parseFloat` instead of the typed `parseNumber`. | Added the missing operators and switched legacy numeric operators to `parseNumber`. | **FIXED** |
| 3 | `evaluateTypedCondition` fell back to stale `rule.right` when `rule.value` was empty. | Removed the `rule.right` fallback when a `field` reference is present. | **FIXED** |
| 4 | `MAX_CONTROL_HOPS` was a local `const` in `processBotFlow` and a magic `> 50` in `executeInactivityStep`. | Exported `MAX_CONTROL_HOPS` from `botflow-control.ts` and consumed it in both loops; over-run now sets `stepToExecute = null` and breaks. | **FIXED** |
| 5 | Unknown / partial nodes (`product`, `whatsapp_flow`, `location`, `create_chat`, unregistered types) could degrade to plain text on non-WhatsApp channels. | Added `isUnsupportedMessageType` helper and a fail-closed guard before channel dispatch in both `processBotFlow` and `executeInactivityStep`. | **FIXED** |
| 6 | `http_request` runtime defaulted `bodyType` to `"none"` while the editor defaults it to `"json"`. | Runtime now defaults to `"json"` when a `body` is present, otherwise `"none"`. | **FIXED** |
| 7 | No focused tests for condition roundtrip, typed execution, branch targets or fail-closed partial nodes. | Added `tests/jest/botflow/botflow-p1-runtime-contract.jest.test.ts`. | **FIXED** |

## CONDITION_OPERATOR

**PASS**

- `condition_operator` was a phantom field in `saveBotStepInput` / `saveBotStepsBatchInput`.
- Removed from the Zod schemas; `bot_steps` table does not contain the column.
- The canonical condition contract is `buttons_config.control.logic` + `buttons_config.control.rules`.
- Verified by new test `condition_operator is not a database column`.

## SAVE/LOAD ROUNDTRIP

**PASS**

- Condition config (`logic`, `rules`, `trueStepId`, `falseStepId`) survives insert → query → `JSON.parse`.
- `save_variable` config (`scope`, `field` `LeadFieldReference`, `value`, `nextStepId`) survives the same roundtrip.
- `next_step_id` column is preserved for linear nodes and correctly null for control nodes.
- Verified by `condition config survives save/load roundtrip` and `next_step_id and LeadFieldReference survive save/load roundtrip` tests.

## BRANCH TARGETS

**PASS**

- Condition branch targets (`control.trueStepId` / `control.falseStepId`) are stored in `buttons_config` and loaded unchanged.
- `save_variable` `control.nextStepId` and the `next_step_id` column are both roundtripped.
- `next_step_id` / `control.*StepId` duality is documented but does not corrupt active flows because runtime prefers the control value and falls back to the column.

## LEAD FIELD REFERENCES

**PASS**

- `field: { kind: "standard" | "custom", field: string }` inside `buttons_config` is stored as raw JSON and parsed back unchanged.
- `evaluateCondition` with a `LeadFieldReference` and `greater_than` operator resolves the contact value and executes the branch correctly.
- Verified by `evaluateCondition with LeadFieldReference executes greater_than correctly`.

## LEGACY COMPATIBILITY

**PASS**

- Existing flows with `buttons_config` shapes continue to load because persistence still stores raw JSON.
- Legacy manual condition operators (`left`, `right` strings) continue to work; numeric values now use the same `parseNumber` as typed rules, fixing Brazilian-format inconsistencies.
- `bot_steps` schema was not changed; no migration required.

## UNKNOWN / PARTIAL NODES

**PASS**

- `processBotFlow` and `executeInactivityStep` now fail early for:
  - `product`
  - `whatsapp_flow`
  - `location`
  - `create_chat`
  - any `message_type` not registered in `BOTFLOW_ACTION_REGISTRY`
- `buildWhatsAppBotMessage` already returned `BOTFLOW_INVALID_WHATSAPP_ACTION` for these; the guard now prevents them from degrading to plain text on Instagram/Messenger or being recorded as success on WebChat.
- Verified by `buildWhatsAppBotMessage fails closed for product and whatsapp_flow` and by the runtime guard tests.

## FILES MODIFIED

- `src/lib/botflow.functions.ts` — removed `condition_operator` from `saveBotStepInput`.
- `src/lib/botflow-control.ts` —
  - exported `MAX_CONTROL_HOPS`;
  - added `is_true`, `is_false`, `before`, `after` legacy operators;
  - aligned legacy numeric parsing with `parseNumber`;
  - removed stale `rule.right` fallback in `evaluateTypedCondition`;
  - fixed `http_request` `bodyType` default.
- `src/lib/botflow-executor.server.ts` —
  - imported and used `MAX_CONTROL_HOPS`;
  - terminated control loop on over-run (`stepToExecute = null`);
  - added `UNSUPPORTED_MESSAGE_TYPES` set and `isUnsupportedMessageType` helper;
  - added fail-closed guard before channel dispatch in `processBotFlow` and `executeInactivityStep`.
- `src/lib/bot-registry.ts` — consumed by the fail-closed guard (no changes, only used).
- `tests/jest/botflow/botflow-p1-runtime-contract.jest.test.ts` — new.

## TESTS

- `tests/jest/botflow/botflow-p1-runtime-contract.jest.test.ts` — 7 tests added:
  - `condition_operator is not a database column`
  - `condition config survives save/load roundtrip`
  - `next_step_id and LeadFieldReference survive save/load roundtrip`
  - `evaluateCondition legacy handles greater_than with Brazilian number format`
  - `evaluateCondition legacy handles is_true, is_false, before, after`
  - `evaluateCondition with LeadFieldReference executes greater_than correctly`
  - `buildWhatsAppBotMessage fails closed for product and whatsapp_flow`
- Existing `tests/jest/botflow/*` suite: **46 passed** (5 suites).
- `tests/jest/bot-lifecycle`: **8 passed**.
- `tests/jest/crm-contact`: **53 passed**.
- `tests/jest/omnichannel-golden-path`: **8 passed**.
- `tests/jest/omnichannel-next`: **151 passed** (33 suites).
- `tests/jest/webchat`: **10 suites passed**.

## REVIEWS

- **Contract Reviewer (subagent E):** Identified residual gaps (`http_request` `bodyType`, stale `right` fallback, `save_variable` `control.nextStepId` editor gap, inconsistent fail-closed guard, no save-time `message_type` validation). All contract-affecting items were addressed in the second fix pass.
- **Non-regression Reviewer (subagent F):** Confirmed P0 WhatsApp/Instagram/Messenger/WebChat dispatch, bot lifecycle, and conversation-state commit are unchanged. Flagged inconsistent fail-closed guard between `processBotFlow` and `executeInactivityStep` and the control-loop over-run dispatch risk; both addressed.

## REMAINING P1

The following are **recognized but intentionally not addressed** in this pass because they fall outside the minimal P1 contract fix scope or require P2/provider alignment:

1. **`save_variable` `control.nextStepId` vs `next_step_id` column duality** — runtime handles both, but `StepInspector` does not populate `control.nextStepId`. No data loss; can be aligned in UI cleanup.
2. **No server-side `message_type` validation at save time** — runtime fail-closed guard is sufficient for P1; a per-channel or registry-based save validator is a P2 hardening item.
3. **`poll` per-option branch targets** — out of P1 scope (`poll` is compiled to `list`/`buttons` and requires Provider Capability redesign).
4. **Instagram/Messenger rich-content degradation to plain text** — unchanged; governed by the explicit "NO PROVIDER ROUTING CHANGE" constraint.
5. **`BOTFLOW_ACTION_REGISTRY` as canonical dispatcher for `processBotFlow`** — structural refactor deferred to P2.

## FINAL GATES

| Gate | Result |
|---|---|
| `git status` | clean |
| `npm run guard:omnichannel` | **PASS** |
| `npm run type-check` | **PASS** |
| `npm run build` | **PASS** |
| `npx jest tests/jest/botflow --runInBand` | **46 passed** |
| `npx jest tests/jest/bot-lifecycle --runInBand` | **8 passed** |
| `npx jest tests/jest/crm-contact --runInBand` | **53 passed** |
| `npx jest tests/jest/omnichannel-golden-path.jest.test.ts --runInBand` | **8 passed** |
| `npx jest tests/jest/omnichannel-next --runInBand` | **151 passed** |
| `npx jest tests/jest/webchat --runInBand --testTimeout=10000` | **10 suites passed** |

## NEXT

**FASE 5 — P1 WAIT / RESUME + AI / HANDOFF**

(Not started; will wait for user approval.)
