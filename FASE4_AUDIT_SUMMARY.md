# FASE 4 — AUDIT SUMMARY

## 1. BASELINE

- HEAD: `d121f07`
- Branch: `main` (up to date)
- Worktree: clean
- Guard: PASS (`72cc7ffe...`)
- `npx tsc --noEmit`: PASS
- `npx jest tests/jest/crm-contact --runInBand --testTimeout=10000`: PASS (53 tests)

## 2. SUBAGENTS USED

- SUBAGENT 1 — CRM / Contact Model
- SUBAGENT 2 — Custom Field Engine
- SUBAGENT 3 — Bot Flow Editor
- SUBAGENT 4 — Bot Flow Runtime
- SUBAGENT 5 — Automations / Campaigns
- SUBAGENT 6 — Security / Multi-tenant
- SUBAGENT 7 — Tests / Non-regression

## 3. KEY FINDINGS

### 3.1 Custom Field Engine

- `ContactCustomFieldService` (`src/lib/services/contact-custom-field.service.ts`) already provides canonical read/write with tenant isolation, type validation, and JSON fallback.
- `setContactFieldValues` accepts `{ custom_field_id, value }` or `{ key, value }`.
- `getContactFieldValues` reads canonical values and falls back to legacy JSON for defined fields not yet migrated.
- Supported types: `text`, `textarea`, `number`, `currency`, `date`, `datetime`, `select`, `multi_select`, `boolean`, `email`, `phone`, `url`.

### 3.2 CRM Contact Model

- Standard fields (columns) include: `name`, `email`, `phone_e164`, `whatsapp_number`, `company`, `position`, `notes`, `status`, `responsible_user_id`, `source`, `source_type`, `source_name`, `source_id`, `external_id`, `external_contact_id`, `metadata`, `custom_fields`, etc.
- Write paths are duplicated across `contacts.service.ts`, `contacts.functions.ts`, `chat-actions.functions.ts`, `contact-identity.service.ts`, `webhooks.server.ts`, and `botflow-control.ts`.
- `updateContactForUser` does a full `UPDATE` with `preserveOrValue`, but `custom_fields` JSON schema is unrestricted (`z.record(z.string(), z.any())`), allowing arbitrary keys (mass-assignment risk for `__proto__`, `tenant_id` stored in JSON, etc.).
- `phone_e164` is a routing-related column. CRM phone edits must not change `channel`/`provider`.

### 3.3 Bot Flow Runtime

- Runtime in `src/lib/botflow-executor.server.ts` loads `contacts.custom_fields` JSON into `executionContext.contact.customFields`.
- `resolveTemplate` supports `{{contact.name}}`, `{{contact.phone}}`, `{{contact.email}}`, `{{contact.company}}`, `{{contact.notes}}`, `{{contact.custom_fields.<key>}}`, `{{variables.<key>}}`, `{{message.text}}`, `{{channel}}`, `{{http.response...}}`.
- `executeSaveVariable` uses a raw `key` string and a hardcoded standard-field whitelist `name`, `email`, `company`, `notes`. It calls `setContactFieldValues` by key or falls back to legacy JSON.
- `evaluateCondition` is fully string-based; numeric operators parse floats; `exists`/`is_empty` check string length. There is no type/field metadata.
- `processBotFlow` currently resolves control nodes synchronously (`condition` is sync). It can be made async without major changes.

### 3.4 Bot Flow Editor

- `StepInspector.tsx` configures `save_variable` with free-text `key` and `value` inputs.
- Condition rules also use free-text `left`/`right` and a generic `operator` select.
- Message body is a free textarea where users manually type `{{...}}`.
- `bot_steps` stores per-node config in `buttons_config` JSON under `control` or `action`.
- No dedicated picker for standard/custom contact fields.

### 3.5 Automations

- No separate automation/workflow engine beyond Bot Flow and Campaign dispatcher.
- Campaigns use `whatsapp-payload.ts` interpolation, which reads `contact.name` and `contact.custom_fields` JSON for variables. It does not read canonical `contact_custom_field_values`.

### 3.6 Security Gaps

- `custom_fields` and `metadata` schemas accept arbitrary keys, enabling prototype pollution keys and storage of technical keys (e.g., `tenant_id`) in JSON.
- `createContactForUser`/`updateContactForUser` merge `incomingCustomFields` without key whitelist before syncing to canonical table.
- `bulkUpsertContacts` does `JSON_MERGE_PATCH` with raw `custom_fields` payload.
- `listStandardFields` exposes `external_id`/`source_name` as standard fields, which may be too broad for Lead Field editing.
- `getTenantCustomFieldKeys` uses `user_id OR tenant_id`, while `setContactFieldValues` uses `AND user_id = ?`; the OR is more permissive for reads.

## 4. RECOMMENDED ARCHITECTURE

```text
LeadFieldRegistry
        │
        ├─ StandardFieldRegistry (whitelist: name, email, phone, company, position, notes, responsible_user_id)
        │
        └─ CustomFieldRegistry (contact_custom_fields WHERE tenant)
        │
        ↓
LeadFieldService
        │
        ├─ getLeadFieldValue(tenantId, contactId, ref)
        └─ setLeadFieldValue(tenantId, contactId, ref, value)
        │
        ↓
   BotFlowRuntime  ── evaluateCondition / executeSaveVariable / resolveTemplate
        │
        ↓
     Contact
```

### 4.1 LeadFieldReference

```ts
type LeadFieldReference =
  | { kind: "standard"; field: StandardLeadField }
  | { kind: "custom"; fieldDefinitionId: string };
```

`StandardLeadField` whitelist: `name`, `email`, `phone`, `company`, `position`, `notes`, `responsible_user_id`.

- `phone` maps to `contacts.phone_e164` and `normalized_phone`.
- `responsible_user_id` maps to `contacts.responsible_user_id` with tenant-scoped user validation.
- `email` maps to `contacts.email`.
- `name`, `company`, `notes` map directly.

### 4.2 Runtime Changes

1. `lead-field.service.ts` centralizes registry, read, and write.
2. `botflow-executor.server.ts` preloads canonical custom fields and standard fields into `executionContext.contact`.
3. `botflow-control.ts`:
   - `SaveVariableConfig` gains optional `field: LeadFieldReference`.
   - `executeSaveVariable` uses `setLeadFieldValue` when `field` is present; falls back to legacy key when absent.
   - `ConditionRule` gains optional `field: LeadFieldReference` and `value`.
   - `evaluateCondition` uses typed comparison when `field` is present.
   - `resolveTemplate` resolves `{{contact.<key>}}` and `{{contact.custom_fields.<key>}}` against preloaded canonical values.
4. `StepInspector.tsx` adds a `LeadFieldPicker` for Save Variable and Condition nodes (optional in this phase; can be additive). Message editor can keep `{{...}}` syntax but a picker inserts `{{contact.<key>}}` or `{{field:<key>}}`.

### 4.3 Backward Compatibility

- Legacy `save_variable` nodes with raw `key` continue to work under Fase 3B rules (canonical if definition exists; legacy JSON fallback for existing keys; new unknown keys blocked).
- Legacy condition rules with `left`/`right` strings keep string semantics.
- New `save_contact_field` nodes (or `save_variable` with `field`) use typed `LeadFieldReference`.

## 5. RISKS

- Changing `evaluateCondition` to typed may break existing flows if operators behave differently.
- Frontend `StepInspector` is large; adding field picker must not break existing node rendering.
- Campaign interpolation still reads JSON cache; canonical writes already sync JSON, so it remains consistent.
- Phone update in Lead Field writer must not create/update `contact_identities` or change conversation `channel`.

## 6. IMPLEMENTATION OWNERSHIP

- `lead-field.service.ts` → backend service
- `botflow-control.ts` → runtime save/condition/interpolation
- `botflow-executor.server.ts` → context loading
- `StepInspector.tsx` + `CustomNode.tsx` (optional) → editor UI
- `tests/jest/botflow/lead-field-*.jest.test.ts` → tests

## 7. PROTECTED FILE IMPACT

- `src/lib/messaging/processor.server.ts`, `outbound/adapters/`, `webchat/`, `chat.functions.ts` are protected by omnichannel freeze but not touched.
- `botflow-control.ts`, `botflow-executor.server.ts`, `contacts.service.ts`, `contact-custom-field.service.ts` are not protected.

## 8. MIGRATION REQUIRED

NO. The phase reuses existing `contact_custom_fields`, `contact_custom_field_values`, `contacts`, `bot_flows`, `bot_steps` tables.

## 9. TEST GAP MATRIX

| Area | Existing | Missing |
|------|----------|---------|
| Lead field registry | basic `listStandardFields` | tenant-scoped lead field list, standard+custom merge |
| Save standard field from bot | `executeSaveVariable` key-based | typed `field` save for `name`, `email`, `phone`, `company`, `position`, `notes` |
| Save custom field from bot | canonical key save exists | typed `fieldDefinitionId` save, invalid select/option, rename survival |
| Condition by field | string `left`/`right` | typed `field` condition with numeric/select/boolean operators |
| Interpolation | `{{contact.custom_fields.<key>}}` from JSON | canonical-based `{{contact.<key>}}` and missing-value policy |
| Phone update provider | contact-channel-validation | bot saves phone and conversation provider unchanged |
| Cross-tenant field | custom-field-hardening | bot config referencing other tenant's `fieldDefinitionId` blocked |
| Invalid operator/type | type validation in custom-field service | condition operator validation per field type |

## 10. NEXT ACTION

Proceed to implementation of `lead-field.service.ts` and runtime integration.
