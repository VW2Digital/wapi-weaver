# META V3 — PHASE E RUNTIME CLOSURE REPORT

## CUTOVER CONNECTION

- Real migrated connection: YES
- Test fixture only: NO
- Duplicate Meta connections: NO (fixture still present but separate)
- Duplicate channel connections: NO

Legacy WhatsApp profile `6da65e93-...` was migrated into:
- Meta App Connection `8536d6d8-fc08-4b60-ba88-386f5aac1335`
- Public ID `7a0796da-55ff-4dba-8b35-95ff65b53142`
- Channel Connection `f4c277a7-3e71-408f-abc7-c4938e7a8727`
- Provider `whatsapp`
- External Account ID `1107720082434785`

## ENCRYPTION

- Persistent key: CONFIGURED in `.env`
- Stored securely: PASS
- Git exposure: NO

## REKEY

- Meta App Connection: PASS
- App Secret: REENCRYPTED with persistent key
- Verify Token: REGENERATED with persistent key
- Public ID changed: NO
- Channel relation preserved: YES

## RESTART

- Normal environment load: PASS
- App Secret decrypt: PASS
- Verify Token decrypt: PASS

## MULTIPLE META APP

- Latest fallback: REMOVED from `onboardWhatsApp`
- WhatsApp deterministic resolution: V3 channel service looks up by `provider` + `external_account_id`
- 2 Meta Apps test: NOT_EXECUTED

## CHANNEL SERVICE

- WhatsApp V3-first: PASS
- WhatsApp legacy fallback: PASS (only when no V3 record)
- Broken V3 falls back: NO
- Instagram: REQUIRES_REAUTH (legacy path unchanged)
- Messenger: NOT_CONFIGURED (legacy path unchanged)

## ACCESS TOKEN

- Legacy source: still present in `profiles` (not deleted)
- V3 encrypted: YES (`channel_connections.access_token_encrypted`)
- Plaintext metadata: NO
- Outbound uses V3: PARTIAL — `getWhatsAppChannelConfig` now returns V3 token

## MIGRATION

- Script: `scripts/migrate-legacy-meta-v3.ts`
- Applied: `--apply`
- Result: 1 real WhatsApp tenant migrated to V3

## SCHEMA

- `meta_app_connections`: present in live DB
- `channel_connections`: present in live DB
- `access_token_encrypted`: added via migration 044
- `canonical-schema.sql`: PENDING (auto-generated)
- `schema-contract.json`: PENDING (auto-generated)

## TEST RUNNER

- Runner: Vitest
- Command: `npx vitest run tests/meta-v3-multi-tenant.test.ts tests/meta-v3-phase-b.test.ts tests/meta-v3-phase-c.test.ts tests/meta-v3-phase-c2.test.ts`
- Passed: 19
- Failed: 0
- Result: PASS

## BUILD

- Command: `npm run build`
- Exit Code: 0
- Result: PASS

## TYPECHECK

- Command: `npm run type-check`
- Exit Code: 0
- Result: PASS

## HTTP RUNTIME

- GET `http://localhost:3000/api/public/meta-webhook/{public_id}`
  - Status: 200
  - Body: challenge
  - Result: PASS
- POST `http://localhost:3000/api/public/meta-webhook/{public_id}`
  - Signature: HMAC-SHA256 valid
  - Status: 200 ok
  - Result: PASS
- Wrong encryption key: FAIL_CLOSED

## APP URL / CALLBACK

- Public URL resolved: NO (local only)
- Public callback constructible: YES
- Callback template: `{APP_URL}/api/public/meta-webhook/{public_id}`
- HTTPS tested: NO

## DOCKER

- Build: NOT_EXECUTED
- Startup: NOT_EXECUTED
- Diagnosis: local Node runtime used for HTTP tests

## CONTACTS

- WhatsApp: NOT_TESTED in this phase
- Group: NOT_TESTED in this phase

## LEGACY

- Legacy data deleted: NO
- Legacy credentials removed: NO
- Legacy endpoints removed: NO

## READY FOR PUBLIC DEPLOY

NO

## READY FOR REAL META CALLBACK

NO (requires public HTTPS deploy)

## READY FOR LEGACY CLEANUP

NO
