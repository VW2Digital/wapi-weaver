# Bot Flow P0-A Security & Tenant Isolation Report

## Objective

Close the critical (P0) security and multi-tenant isolation gaps identified in `BOT_FLOW_BUILDER_AUDIT_PHASE1.md` and `BOT_FLOW_NODE_MATRIX.md` for the Bot Flow Builder runtime and editor, without changing the omnichannel provider dispatch layer or protected channels.

## Scope

P0-A covers:

1. SSRF / HTTP request hardening (`validateSafeUrlForSSRF`, `executeHttpRequest`).
2. Header / JSON / template injection in `executeHttpRequest`.
3. CTA URL validation in WhatsApp message builder.
4. Local media path traversal in `prepareStepMediaForMeta`.
5. Unsafe `JSON.parse` of flow configuration (`buttons_config`, `trigger_value`).
6. Tenant isolation in `assertBelongsToTenant`, CRUD operations (`saveBotStepsBatch`, `saveBotStep`, `deleteBotStep`, `duplicateBotFlow`, `deleteBotFlow`), and contact write paths in `executeSaveVariable`.
7. Removal of hardcoded `JWT_SECRET` fallback.
8. Contact lookup `phone_e164 LIKE` wildcard removal.

Out of scope for P0-A: state/data integrity issues (draft vs. active, versioning, node matrix, provider routing, conversation state schema), runtime `processBotFlow` legacy `user_id`/`tenant_id` OR fallback for old rows, and CTA hostname DNS resolution.

## Changes

| File | Change |
|------|--------|
| `src/lib/botflow-control.ts` | Hardened `validateSafeUrlForSSRF` with `0.0.0.0`, `::`, and full `ipaddr` range blocklist; `executeHttpRequest` now re-validates every redirect, sanitizes header keys/values from `\r\n\0`, rejects invalid JSON after template resolution, and streams the response with a 1MB cap; `executeSaveVariable` now scopes contact updates by `tenant_id` only. |
| `src/lib/meta-whatsapp-message.ts` | Added `isPublicHttpsCtaUrl()` to reject non-HTTPS, local/private/metadata IP CTA URLs; added `safeJsonParse()` reviver to drop `__proto__`/`constructor`/`prototype` from `buttons_config`. |
| `src/lib/botflow-executor.server.ts` | Confined `prepareStepMediaForMeta` to `public/uploads` with `..`/null-byte/path traversal checks; added JSON reviver to all `buttons_config` and `trigger_value` parses; replaced `phone_e164 LIKE` with exact `phone_e164 = ? OR whatsapp_number = ?` matching. |
| `src/lib/botflow.functions.ts` | `assertBelongsToTenant` calls now strictly check `tenant_id`; `saveBotStepsBatch`, `saveBotStep`, `deleteBotStep`, `duplicateBotFlow`, `deleteBotFlow` now scope all selects/updates/deletes by `tenant_id`. |
| `src/lib/tenant-authorization.ts` | Removed `OR user_id = ?` and `OR tenant_id IS NULL` fallbacks from `assertBelongsToTenant` for all resource types. |
| `src/integrations/mysql/auth-middleware.ts` | Moved `JWT_SECRET` missing check inside `requireAuth` so the module no longer crashes on import, while still rejecting unconfigured secrets at request time. |
| `tests/jest/botflow/botflow-p0a-security.jest.test.ts` | New focused P0-A unit tests covering SSRF host/IP rejection, redirect re-validation, header sanitization, invalid JSON body, 1MB response cap, CTA URL validation, and template output. |

## Verification

Commands run and results:

```bash
npm run type-check                 # PASS
npm run build                      # PASS
npm run guard:omnichannel          # PASS (no protected changes)
```

Test regression suite (with `DB_PASSWORD` and `JWT_SECRET` set):

```bash
npx jest \
  tests/jest/botflow \
  tests/jest/crm-contact/custom-fields \
  tests/jest/omnichannel-golden-path.jest.test.ts \
  tests/jest/webchat/webchat-step2b.jest.test.ts \
  tests/jest/webchat/webchat-rate-limit.jest.test.ts \
  tests/jest/meta-whatsapp-message.jest.test.ts \
  --runInBand --testTimeout=10000
```

Result: `Test Suites: 8 passed, 8 total`.

## Residual Risks & Next Steps

| Risk | Reason | Mitigation / Next Step |
|------|--------|------------------------|
| Legacy rows with `tenant_id = NULL` in `bot_steps`/`bot_flows` | `assertBelongsToTenant` and CRUD now enforce `tenant_id = ?`. | Run a migration to backfill `tenant_id` from `user_id` or `team.tenant_id`; until then, legacy editor/admin rows may become inaccessible. |
| Runtime `processBotFlow` still uses `(user_id = ? OR tenant_id = ?)` | Intentionally left for runtime compatibility with legacy rows. | Revisit in P0-B state/data-integrity phase once migration is complete. |
| CTA URL hostname DNS resolution | `isPublicHttpsCtaUrl()` only validates the literal hostname/IP; it does not resolve DNS. | For CTA links, the Meta API and user agent perform the actual fetch; server-side resolution is low risk, but a DNS-aware validator could be added later if required. |
| Exact `phone_e164` contact matching | `LIKE` was replaced with exact equality; stored and incoming formats must match. | The `triggerWebhookBotFlow` already strips `phone_e164` with `/\D/g` before lookup; monitor for contacts stored with punctuation vs. E.164. |
| Double-encoded path traversal (`%252e%252e`) | `decodeURIComponent` runs once. | Add an additional normalization loop or canonicalization in `prepareStepMediaForMeta` in a follow-up hardening phase. |

## Conclusion

P0-A closes the immediate SSRF, injection, media traversal, unsafe JSON parsing, hardcoded secret, and tenant-isolation vulnerabilities while preserving the existing omnichannel golden path and webchat runtime. The remaining risks are documented and should be addressed in the next state/data-integrity phase after a tenant backfill migration.
