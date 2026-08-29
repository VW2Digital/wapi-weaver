# META V3 — PHASE D3 SECURITY & CUTOVER REPORT

## ENCRYPTION KEY

- Previous test key: REPLACED
- Persistent key: CONFIGURED in `.env` (local, not in git)
- Stored securely: PASS (not in source, docs, tests, migrations)
- Git exposure: NO (`.env` is gitignored)

## REKEY

- Meta App Connection: PASS
- App Secret: ENCRYPTED with persistent `META_CREDENTIALS_ENCRYPTION_KEY`
- Verify Token: GENERATED and ENCRYPTED with persistent key
- Public ID changed: NO (`00000000-0000-0000-0000-000000000001` preserved)
- Channel relation preserved: YES

## RESTART

- Normal environment load: PASS
- App Secret decrypt: PASS (verified via GET/POST)
- Verify Token decrypt: PASS (verified via GET)

## MULTIPLE META APP

- Latest fallback: REMOVED from `onboardWhatsApp`
- WhatsApp deterministic resolution: PARTIAL — `onboardWhatsApp` now requires explicit `meta_app_connection_id`
- `settings.tsx` lists connections and requires explicit selection
- 2 Meta Apps test: NOT_EXECUTED (requires second fixture)

## CALLBACK

- Public URL resolved: NO (local `http://localhost:3000` only)
- HTTPS: NOT_TESTED
- Callback URL ready for local testing: YES
- Callback URL template: `{APP_URL}/api/public/meta-webhook/{public_id}`

## LOCAL V3

- GET after rekey: PASS (200, returned challenge)
- POST after rekey: PASS (200 ok)
- Wrong encryption key: FAIL_CLOSED (`Unsupported state or unable to authenticate data`)

## DOCKER

- App: NOT_TESTED
- Worker: NOT_TESTED
- Encryption key present: YES in `.env`

## CANONICAL SCHEMA

- `meta_app_connections`: PENDING (not in `canonical-schema.sql` / `schema-contract.json`)
- `channel_connections`: PENDING
- `meta_config_id`: APPLIED in database via migration 043

## DOCUMENTATION

- `docs/CONFIGURACAO-META.md`: PASS (updated)
- `docs/SEGURANCA.md`: PASS (updated)
- No global Meta credentials documented: PASS

## OLD GLOBAL META ENV

- `VITE_META_APP_ID`: 0 runtime refs in `src/`
- `VITE_META_CONFIG_ID`: 0 runtime refs in `src/`
- `META_APP_SECRET`: 0 runtime refs in `src/`
- `META_WEBHOOK_VERIFY_TOKEN`: 0 runtime refs in `src/`

## BUILD

- Command: `npm run build`
- Exit Code: 0
- Result: PASS

## TYPECHECK

- Command: `npm run type-check`
- Exit Code: 0
- Result: PASS

## TEST SUITES

- `npm test -- tests/jest/messaging`: PASS
- `tests/meta-v3-*.test.ts`: NOT_EXECUTED (Jest pattern mismatch / no runtime test runner for these files)

## REAL META

- GET: NOT_RUN (local simulation only)
- INBOUND: NOT_RUN
- OUTBOUND: NOT_RUN

## LEGACY

- Legacy data deleted: NO
- Legacy credentials removed: NO
- `profiles`, `instagram_accounts`, `facebook_pages` remain intact

## READY FOR USER TO CONFIGURE META CALLBACK

YES (local environment)

## READY FOR LEGACY CLEANUP

NO

## NEXT OPERATOR STEPS

1. Deploy to an environment with a public HTTPS domain.
2. Configure `APP_URL` to the real domain.
3. In the WAPI Weaver UI, copy the Callback URL for the Meta App Connection.
4. Paste the Callback URL and Verify Token into the Meta Developers dashboard.
5. Send a real WhatsApp message to trigger the handshake and inbound flow.
