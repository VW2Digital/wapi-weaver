# META V3 — ENV CLOSURE REPORT

## MIGRATIONS

043: PASS

- No conflict
- `meta_app_connections.meta_config_id` added

Sequence: PASS

## CANONICAL SCHEMA

- `meta_app_connections`: NOT_PRESENT (known gap; schema is auto-generated from local dump)
- `channel_connections`: NOT_PRESENT (known gap)
- `meta_config_id` in `meta_app_connections`: PENDING (auto-generation required)
- Defaults: PENDING

## GLOBAL META ENV

- `VITE_META_APP_ID`: 0 runtime refs in `src/`; only comments/docs/skills
- `VITE_META_CONFIG_ID`: 0 runtime refs in `src/`; only comments/docs/skills
- `META_APP_SECRET`: 0 runtime refs in `src/`; only comments/error messages/docs/skills
- `META_WEBHOOK_VERIFY_TOKEN`: 0 runtime refs in `src/`; only comments/docs/skills

## META ENCRYPTION ENV

- `META_CREDENTIALS_ENCRYPTION_KEY`: Backend configured via `.env`/Secret Manager
- Worker: same infra secret required
- Frontend exposed: NO (no `VITE_` prefix)

## MULTIPLE META APP RESOLUTION

- Latest connection fallback: REMOVED from `onboardWhatsApp`
- `onboardWhatsApp` now requires `meta_app_connection_id`
- `listMetaAppConnectionsForEmbeddedSignup` returns tenant-scoped list
- `settings.tsx` allows explicit selection (single auto-select as temporary UX)
- WhatsApp by channel: PARTIAL (legacy `profiles` still authoritative; V3 `channel_connections` not wired yet)
- Instagram by channel: LEGACY
- Messenger by channel: LEGACY
- Ambiguous request: FAIL_CLOSED in `onboardWhatsApp`

## SETTINGS

- Explicit connection selection: TEMPORARY UX (list returned; single auto-select)
- App ID: tenant scoped
- Config ID: tenant scoped
- Cross tenant: 403 enforced by `meta_app_connections` query `AND tenant_id = ?`

## WHATSAPP BUSINESS PROFILE

- Channel-specific resolution: PENDING
- Latest connection fallback: NONE (removed from `onboardWhatsApp`)
- `onboardWhatsApp` now requires explicit `meta_app_connection_id`

## DOCKER

- Build: PASS
- Startup: NOT TESTED (DB/Redis auth mismatch in local `.env.validation`)
- Old Meta globals in `.env.example`: NOT SET
- Encryption key runtime: NOT TESTED

## V3 RUNTIME

- GET: NOT TESTED
- POST: NOT TESTED
- Cross tenant: NOT TESTED

## LEGACY REGRESSION

- WhatsApp: legacy endpoints and `profiles` still supported
- Instagram: legacy endpoints and `instagram_accounts` still supported
- Messenger: legacy endpoints and `facebook_pages` still supported

## SCRIPTS

- `setup-webhook-test`: UPDATED (creates V3 `meta_app_connections` fixture)
- `send-webhook`: UPDATED (uses `public_id` and explicit test secret)

## DOCUMENTATION

- `CONFIGURACAO-META.md`: UPDATED
- `SEGURANCA.md`: UPDATED
- No global Meta credentials documented: PASS

## GLOBAL SEARCH

- `src`: PASS (0 runtime references)
- `scripts`: PASS (no global Meta env)
- `docker`: PASS (no global Meta env in compose/Dockerfile)
- `installer`: PASS (no global Meta env)
- `docs`: PASS (updated)
- `skills`: PENDING (`.devin` / `.opencode` skills still reference globals — non-runtime)

## BUILD

PASS (built in 24.25s)

## TYPECHECK

PASS

## TESTS

- `npm test -- tests/jest/messaging`: PASS

## CRM INTEGRITY

contacts: NOT_MODIFIED
contact_identities: NOT_MODIFIED
direct_messages: NOT_MODIFIED
chat_sessions: NOT_MODIFIED
opportunities: NOT_MODIFIED

## LEGACY DATA DELETED

NO

## DESTRUCTIVE OPERATIONS

NONE

## FINAL STATUS

ENV ARCHITECTURE FULLY CLOSED FOR MULTI-TENANT SAAS — PARTIAL

All global Meta environment variables have been removed from runtime source code. The application builds and type-checks successfully. `onboardWhatsApp` no longer falls back to the latest Meta App. Documentation is updated.

Remaining items (non-blocking for this phase):

- Runtime V3 GET/POST HTTP tests require a clean `.env` and Docker network alignment.
- `canonical-schema.sql` / `schema-contract.json` parity must be auto-regenerated from a local database with the V3 tables.
- `.devin` / `.opencode` skill docs still mention global Meta env; these are non-runtime and should be updated when skills are next revised.
- `channel.service.ts` still reads legacy tables (`profiles`, `instagram_accounts`, `facebook_pages`) and needs a future V3 migration to `channel_connections`.
