# Bot Flow Builder Audit — Phase 1

## Baseline

| Item | Result |
|------|--------|
| `git status` | `.omnichannel-freeze.json` modified |
| `git rev-parse --short HEAD` | `ae056de` |
| `npm run guard:omnichannel` | **PASS** (no protected changes since baseline) |

## Architecture

### Editor
- `StepInspector` is the single node configuration panel; it writes `buttons_config` (JSON) and `next_step_id`.
- `BotFlowCanvas` / `CustomNode` render nodes and edges; `sourceHandle` / `handleId` is used only to identify which UI element was connected, then discarded by the runtime.
- `BotComponentsSidebar` is the component palette; it does not expose `dynamic_buttons`, `product`, `product_list`, `catalog_message`, `location`, `sticker`, `whatsapp_flow`.

### Storage
- `bot_flows` holds the flow header; `bot_steps` holds one row per node; `buttons_config` JSON holds options, branches and interactive payloads.
- There are no `draft` / `version` columns.
- `bot_step_options` exists in `database/schema/canonical-schema.sql` but is never read or written by runtime code.

### Runtime
- `processBotFlow` (`src/lib/botflow-executor.server.ts:266`) is a monolithic `if/else`; `BOTFLOW_ACTION_REGISTRY` is not used for dispatch.
- Control loop (`src/lib/botflow-executor.server.ts:802-891`) handles `delay`, `condition`, `randomizer`, `save_variable`, `http_request`.
- WhatsApp is the only channel with a real payload builder (`buildWhatsAppBotMessage`); Instagram/Messenger send only `{ message: { text: ... } }`.
- WebChat only generates a UUID and logs.

### State
- `bot_conversation_state` stores `current_step_id`, `is_paused`, `paused_until`.
- `upsert` uses `onConflict: "user_id,contact_number,instance_id,channel"`, but the table unique key is `(user_id, contact_number, instance_id)`.

## Confirmed Findings

### P0
- **HTTP `http_request` SSRF**: `redirect: "follow"` follows 302 without re-validation; `validateSafeUrlForSSRF` does not block `0.0.0.0`; headers are built without `\r\n` sanitization — `src/lib/botflow-control.ts:555-666`.
- **Media path traversal**: `prepareStepMediaForMeta` decodes `?path=` and resolves under `process.cwd()/public/uploads` without blocking `..` — `src/lib/botflow-executor.server.ts:170-226`.
- **Tenant `IS NULL` bypass**: `assertBelongsToTenant` for `bot_flow`/`bot_step` accepts `tenant_id IS NULL` — `src/lib/tenant-authorization.ts:85-86`.
- **Hardcoded JWT fallback**: `JWT_SECRET` falls back to a static string when env is missing — `src/integrations/mysql/auth-middleware.ts:7-9`.
- **Duplicate flow data corruption**: `duplicateBotFlow` copies steps with new UUIDs but does not remap `next_step_id` or `step:<id>` references inside `buttons_config` — `src/lib/botflow.functions.ts:423-449`.
- **State upsert key mismatch**: `bot_conversation_state.upsert` `onConflict` includes `channel`, but the unique key does not — `src/lib/botflow-executor.server.ts:847-861,945-958`.
- **Double bot trigger**: legacy `whatsapp-webhook.ts` calls `processBotFlow` directly and also enqueues the same event to the canonical worker — `src/routes/api/public/whatsapp-webhook.ts:1149,1731,2123`.
- **Inexact contact lookup**: `phone_e164 LIKE %...%` can match the wrong contact — `src/lib/botflow-executor.server.ts:749-752`.
- **Tenant/user conflation**: `processBotFlow` uses the same parameter for `user_id` and `tenant_id` filters — `src/lib/botflow-executor.server.ts:299-302,408-423`.

### P1
- **Lost `condition_operator`**: accepted by `saveBotStepInput` but the `bot_steps` table has no such column — `src/lib/botflow.functions.ts:581`.
- **Unvalidated `webhook` conditions**: `saveBotStepsBatch` does not validate the trigger condition JSON — `src/lib/botflow.functions.ts:604-808`.
- **Opaque `buttons_config`**: `z.any()` allows arbitrary JSON; no per-node schema validation — `src/lib/botflow.functions.ts:586,701`.
- **`link_ai_agent` lifecycle gap**: `processAiAgent` is called with no `preSendDecision` after AI generation; it is also hard-coded to `channel === "whatsapp"` — `src/lib/botflow-executor.server.ts:997-1011`.
- **AI race**: `processAiAgent` does not re-check `bot_active`/`is_paused` before sending the AI reply — `src/lib/ai-agent.server.ts:89-127`.
- **Provider capability mismatch**: Instagram/Messenger degrade media, buttons, lists, polls, CTA and PIX to plain text — `src/lib/botflow-executor.server.ts:1107-1180`.
- **`poll` branching gap**: editor has no per-option destination; runtime compiles it as a list and cannot route by selected option — `src/components/bot-flow/StepInspector.tsx:580-648`.
- **`executeInactivityStep` divergence**: duplicates control loop and hardcodes `> 50` hops instead of `MAX_CONTROL_HOPS` — `src/lib/botflow-executor.server.ts:1317-1380`.
- **Unimplemented `product` / `whatsapp_flow`**: editor can configure, but `buildWhatsAppBotMessage` has no cases; runtime returns `BOTFLOW_INVALID_WHATSAPP_ACTION` — `src/lib/meta-whatsapp-message.ts:105-106`.
- **Broad keyword matching**: `matchesConfiguredTrigger` uses `includes` for substrings of length >= 3, causing false positives — `src/lib/botflow-executor.server.ts:436-451`.
- **`cta_url` SSRF bypass**: only checks `https:` / `new URL`; does not call `validateSafeUrlForSSRF` — `src/lib/meta-whatsapp-message.ts:103`.

### P2
- `bot_step_options` table exists but is dead code.
- `sourceHandle` / `handleId` is persisted in `buttons_config` but ignored at runtime.
- `first_message`, `tag_assigned`, `queue_assigned`, `instagram_event`, `shopify_event` appear in the sidebar but are not configurable in `StepInspector`.
- `location` and `sticker` are in `BOTFLOW_ACTION_REGISTRY` but have no editor or full runtime support.
- No `draft` / `version` columns in `bot_flows` / `bot_steps`.
- `triggerWebhookBotFlow` is effectively WhatsApp-only because it resolves `profile.whatsapp_phone_number_id`.
- `executeSaveVariable` legacy scoping conflates `tenant_id` and `user_id` — `src/lib/botflow-control.ts:761,777`.

## Dead / Legacy Code
- `bot_step_options` (schema only)
- `dynamic_buttons` alias in `BOTFLOW_ACTION_REGISTRY`, not exposed in the sidebar
- `location` and `sticker` entries in `BOTFLOW_ACTION_REGISTRY` with no real editor/runtime

## Protected Files

| File | Why Protected | Expected Change | Risk |
|------|---------------|-----------------|------|
| `src/lib/botflow-executor.server.ts` | Core runtime | Dispatch / state fixes | Breaks bot-lifecycle and webchat tests |
| `src/lib/tenant-authorization.ts` | Ownership guard | Remove `IS NULL` clause | Affects all tenant-scoped routes |
| `src/lib/botflow-control.ts` | Control-node execution | SSRF / template fixes | Affects `http_request`, `condition`, `randomizer` |
| `src/routes/_app/chat.tsx` | Out of scope (flickering) | None in this phase | Do not touch |

## Test Gaps
- No `StepInspector` UI tests
- No `BotFlowCanvas` / `CustomNode` interaction tests
- No save/load roundtrip tests for all node types
- No SSRF / HTTP / path-traversal security tests
- No `duplicateBotFlow` remapping tests
- No `link_ai_agent` lifecycle race tests
- No Instagram/Messenger bot-flow dispatch tests
- No `bot_conversation_state` concurrency tests

## Recommended Fix Order

1. **Security + Tenant Isolation** — SSRF/HTTP, media path traversal, `assertBelongsToTenant`, `JWT_SECRET`
2. **State / Data Integrity** — `bot_conversation_state` `onConflict`, `duplicateBotFlow` UUID remapping, `phone_e164` exact match, `condition_operator` decision
3. **Runtime Contract Alignment** — `buttons_config` schema, `product`/`whatsapp_flow` fail-closed, `matchesConfiguredTrigger` exact matching
4. **Wait / Resume + AI / Handoff** — `link_ai_agent` lifecycle, `executeInactivityStep` shared `MAX_CONTROL_HOPS`, `poll` branching
5. **Provider Capabilities + Editor Alignment** — Instagram/Messenger rich-content or channel restrictions, sync sidebar with `BOTFLOW_ACTION_REGISTRY`
