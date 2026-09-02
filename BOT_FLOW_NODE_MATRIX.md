# Bot Flow Node Matrix

## Complete Node Matrix

| Node | Editor | Save/Load | Runtime | Wait | WA | IG | WC | Security | Tests | Status | Severity |
|------|--------|-----------|---------|------|----|----|----|----------|-------|--------|----------|
| start | OK | OK | OK | N/A | Y | Y | Y | SAFE | MISSING | OK | P2 |
| keyword | OK | OK | OK | N/A | Y | Y | Y | SAFE | MISSING | OK | P2 |
| button | OK | OK | OK | N/A | Y | Y | Y | SAFE | MISSING | OK | P2 |
| inactivity | OK | OK | PARTIAL | N/A | Y | Y | Y | SAFE | MISSING | PARTIAL | P1 |
| webhook | PARTIAL | OK | PARTIAL | N/A | Y | N | N | SAFE | MISSING | PARTIAL | P1 |
| first_message | GHOST | OK | OK | N/A | Y | Y | Y | SAFE | MISSING | GHOST | P2 |
| tag_assigned | GHOST | OK | BROKEN | N/A | N | N | N | SAFE | MISSING | GHOST | P2 |
| queue_assigned | GHOST | OK | BROKEN | N/A | N | N | N | SAFE | MISSING | GHOST | P2 |
| instagram_event | GHOST | OK | BROKEN | N/A | N | N | N | SAFE | MISSING | GHOST | P2 |
| shopify_event | GHOST | OK | BROKEN | N/A | N | N | N | SAFE | MISSING | GHOST | P2 |
| text | OK | OK | OK | N/A | Y | Y | Y | SAFE | COVERED | OK | P2 |
| image | OK | OK | OK | N/A | Y | N | N | BROKEN | COVERED | PARTIAL | P1 |
| video | OK | OK | OK | N/A | Y | N | N | BROKEN | COVERED | PARTIAL | P1 |
| audio | OK | OK | OK | N/A | Y | N | N | BROKEN | COVERED | PARTIAL | P1 |
| document | OK | OK | OK | N/A | Y | N | N | BROKEN | COVERED | PARTIAL | P1 |
| sticker | DEAD | OK | BROKEN | N/A | N | N | N | MISSING | MISSING | DEAD | P2 |
| location | DEAD | OK | BROKEN | N/A | N | N | N | MISSING | MISSING | DEAD | P2 |
| buttons | OK | OK | OK | Y | Y | N | N | PARTIAL | COVERED | PARTIAL | P1 |
| dynamic_buttons | GHOST | OK | OK | Y | Y | N | N | PARTIAL | COVERED | GHOST | P2 |
| image_buttons | OK | OK | PARTIAL | Y | Y | N | N | PARTIAL | COVERED | PARTIAL | P1 |
| list | OK | OK | OK | Y | Y | N | N | PARTIAL | COVERED | PARTIAL | P1 |
| poll | OK | OK | PARTIAL | Y | Y | N | N | PARTIAL | COVERED | PARTIAL | P1 |
| cta_url | OK | OK | OK | Y | Y | N | N | BROKEN | COVERED | PARTIAL | P1 |
| pix | OK | OK | OK | N/A | Y | P | P | SAFE | COVERED | PARTIAL | P1 |
| product | OK | OK | BROKEN | N/A | N | N | N | MISSING | MISSING | BROKEN | P1 |
| product_list | PARTIAL | OK | OK | N/A | Y | N | N | PARTIAL | COVERED | PARTIAL | P2 |
| catalog_message | PARTIAL | OK | OK | N/A | Y | N | N | PARTIAL | COVERED | PARTIAL | P2 |
| whatsapp_flow | OK | OK | BROKEN | N/A | N | N | N | MISSING | MISSING | BROKEN | P1 |
| link_ai_agent | OK | OK | PARTIAL | N/A | Y | N | N | BROKEN | MISSING | BROKEN | P1 |
| transfer_chat | OK | OK | OK | Y | Y | Y | Y | PARTIAL | MISSING | PARTIAL | P1 |
| delay | OK | OK | OK | Y | Y | Y | Y | SAFE | MISSING | OK | P2 |
| condition | OK | OK | OK | N/A | Y | Y | Y | SAFE | COVERED | OK | P2 |
| randomizer | OK | OK | OK | N/A | Y | Y | Y | SAFE | MISSING | OK | P2 |
| save_variable | OK | OK | OK | N/A | Y | Y | Y | PARTIAL | COVERED | PARTIAL | P1 |
| http_request | OK | OK | OK | N/A | Y | Y | Y | BROKEN | MISSING | BROKEN | P0 |

### Legend
- **Editor**: `OK` = fully configurable; `PARTIAL` = configurable but limited; `GHOST` = catalog has it but `StepInspector` cannot configure; `DEAD` = not in sidebar/inspector.
- **Save/Load**: `OK` = roundtrip preserves contract; `PARTIAL` = some fields ignored/mis-persisted.
- **Runtime**: `OK` = works end-to-end; `PARTIAL` = works only for some channels or cases; `BROKEN` = fails or silently sends wrong payload.
- **Wait**: `Y` = runtime keeps a waiting state for user reply; `N` = no wait expected.
- **WA / IG / WC**: `Y` = full support; `P` = partial/degraded; `N` = not supported.
- **Security**: `SAFE` = no known issues; `PARTIAL` = known but lower-risk issues; `BROKEN` = known high/critical security flaw.
- **Tests**: `COVERED` = has focused Jest coverage; `MISSING` = no direct coverage.
- **Status**: `OK`, `PARTIAL`, `GHOST`, `BROKEN`, `DEAD`, `UNSUPPORTED`.
- **Severity**: `P0` = security/data corruption/double side effect; `P1` = broken runtime/wrong branching/race; `P2` = debt/dead code/UX.

## Ghost Nodes

A node is classified as `GHOST` when it exists in the catalog/registry but cannot be configured, or when it is configurable but has no real runtime.

| Node | Why Ghost |
|------|-----------|
| first_message | In `BotComponentsSidebar` but not in `StepInspector` trigger select |
| tag_assigned | In sidebar but no `StepInspector` select and no runtime match |
| queue_assigned | In sidebar but no `StepInspector` select and no runtime match |
| instagram_event | In sidebar but no `StepInspector` select and no runtime match |
| shopify_event | In sidebar but no `StepInspector` select and no runtime match |
| dynamic_buttons | In `BOTFLOW_ACTION_REGISTRY` as legacy alias, not in sidebar |

## Provider Capability Matrix

| Node | WhatsApp | Instagram | Messenger | WebChat | Notes |
|------|----------|-----------|-----------|---------|-------|
| text | Y | Y | Y | UUID + log | WebChat is a stub only |
| image | Y | N | N | N | IG/MS send only `message.text` |
| video | Y | N | N | N | IG/MS send only `message.text` |
| audio | Y | N | N | N | IG/MS send only `message.text` |
| document | Y | N | N | N | IG/MS send only `message.text` |
| sticker | Y | N | N | N | Not exposed in editor |
| location | N | N | N | N | Not implemented |
| buttons | Y | N | N | N | IG/MS plain text |
| image_buttons | Y | N | N | N | Normalized to `buttons`; media header ignored |
| list | Y | N | N | N | IG/MS plain text |
| poll | Y | N | N | N | Compiled to list; no option routing |
| cta_url | Y | N | N | N | IG/MS plain text; URL not SSRF-checked |
| pix | Y | P | P | P | PIX text compiled only for WA |
| product | N | N | N | N | Editor exists, runtime returns invalid |
| product_list | Y | N | N | N | Not in sidebar |
| catalog_message | Y | N | N | N | Not in sidebar |
| whatsapp_flow | N | N | N | N | Editor exists, runtime returns invalid |
| link_ai_agent | Y | N | N | N | WA only; other channels send empty text |
| transfer_chat | Y (pause) | Y (pause) | Y (pause) | Y (pause) | Internal handoff, no provider message |
| delay | Y | Y | Y | Y | Control node, no provider message |
| condition | Y | Y | Y | Y | Control node, no provider message |
| randomizer | Y | Y | Y | Y | Control node, no provider message |
| save_variable | Y | Y | Y | Y | Control node, no provider message |
| http_request | Y | Y | Y | Y | Control node, no provider message; SSRF issues |

## P0 Findings

- `http_request` SSRF via redirects, `0.0.0.0`, header injection — `src/lib/botflow-control.ts:555-666`
- `prepareStepMediaForMeta` local file path traversal — `src/lib/botflow-executor.server.ts:170-226`
- `assertBelongsToTenant` `tenant_id IS NULL` bypass — `src/lib/tenant-authorization.ts:85-86`
- Hardcoded `JWT_SECRET` fallback — `src/integrations/mysql/auth-middleware.ts:7-9`
- `duplicateBotFlow` does not remap step UUIDs — `src/lib/botflow.functions.ts:423-449`
- `bot_conversation_state` `upsert` `onConflict` mismatch — `src/lib/botflow-executor.server.ts:847-861,945-958`
- Direct `processBotFlow` in `whatsapp-webhook.ts` double trigger — `src/routes/api/public/whatsapp-webhook.ts:1149,1731,2123`
- `phone_e164` `LIKE %...%` wrong contact resolution — `src/lib/botflow-executor.server.ts:749-752`
- `processBotFlow` tenant/user conflation — `src/lib/botflow-executor.server.ts:299-302,408-423`

## P1 Findings

- `condition_operator` accepted but not persisted — `src/lib/botflow.functions.ts:581`
- `webhook` trigger conditions not validated server-side — `src/lib/botflow.functions.ts:604-808`
- `buttons_config` stored as `z.any()` — `src/lib/botflow.functions.ts:586,701`
- `link_ai_agent` no `preSendDecision` and WhatsApp-only — `src/lib/botflow-executor.server.ts:997-1011`
- `processAiAgent` no lifecycle check during/after generation — `src/lib/ai-agent.server.ts:89-127`
- Instagram/Messenger rich-content degradation to plain text — `src/lib/botflow-executor.server.ts:1107-1180`
- `poll` editor has no option destination, runtime treats as list — `src/components/bot-flow/StepInspector.tsx:580-648`
- `executeInactivityStep` duplicates control loop with hardcoded `> 50` hops — `src/lib/botflow-executor.server.ts:1317-1380`
- `product` / `whatsapp_flow` editor but no runtime — `src/lib/meta-whatsapp-message.ts:105-106`
- `matchesConfiguredTrigger` broad substring matching — `src/lib/botflow-executor.server.ts:436-451`
- `cta_url` URL not SSRF-checked — `src/lib/meta-whatsapp-message.ts:103`

## P2 Findings

- `bot_step_options` table unused
- `sourceHandle` / `handleId` persisted but ignored by runtime
- `first_message`, `tag_assigned`, `queue_assigned`, `instagram_event`, `shopify_event` in sidebar but not in `StepInspector`
- `location`, `sticker` in registry but no editor/full runtime
- No `draft` / `version` columns
- `triggerWebhookBotFlow` WhatsApp-only
- `executeSaveVariable` legacy `tenant_id`/`user_id` conflation

## Dead / Legacy Code

- `bot_step_options` (schema only, no `src/` references)
- `dynamic_buttons` alias in `BOTFLOW_ACTION_REGISTRY` not exposed in sidebar
- `location` and `sticker` registry entries without real support

## Test Gaps

- `StepInspector` / `BotFlowCanvas` / `CustomNode` UI not tested
- Save/load roundtrip for `buttons`, `list`, `condition`, `randomizer`, `http_request` not directly tested
- SSRF, header/JSON injection, path traversal not tested
- `duplicateBotFlow` UUID remapping not tested
- `link_ai_agent` AI race not tested
- Instagram/Messenger bot dispatch not tested
- `bot_conversation_state` concurrency not tested

## Recommended Implementation Order

1. **Security + Tenant Isolation**  
   `http_request` SSRF fixes, `prepareStepMediaForMeta` path traversal, `assertBelongsToTenant`, `JWT_SECRET` fallback, `cta_url` SSRF check.

2. **State / Data Integrity**  
   `bot_conversation_state` `onConflict` fix, `duplicateBotFlow` UUID remapping, `phone_e164` exact match, `condition_operator` decision.

3. **Runtime Contract Alignment**  
   `buttons_config` per-node schema, `product`/`whatsapp_flow` fail-closed or hidden, `matchesConfiguredTrigger` exact matching, `executeInactivityStep` shared `MAX_CONTROL_HOPS`.

4. **Wait / Resume + AI / Handoff**  
   `link_ai_agent` lifecycle, `processAiAgent` final lifecycle gate, `poll` branching, handoff `current_step_id` consistency.

5. **Provider Capabilities + Editor Alignment**  
   Instagram/Messenger rich-content restriction/implementation, sync `BotComponentsSidebar` with `BOTFLOW_ACTION_REGISTRY`, WebChat real delivery or fail-closed.
