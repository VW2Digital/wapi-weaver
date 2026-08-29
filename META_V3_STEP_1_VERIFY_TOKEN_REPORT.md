# META V3 — VERIFY TOKEN & REAL GET REPORT

## Connection

- PASS
- Public ID: `cb608647-8c32-4a31-b69a-5c23fb84fbea`
- Tenant: `eb98852e-25a1-437a-abc8-dfa5e2632832`
- App ID: `1783038629742610`
- Provider: `whatsapp`
- Phone Number ID: `1107720082434785`
- Status: `pending`

## Public ID Match

- MATCH

## Callback

- `https://app.blivcrm.com/api/public/meta-webhook/cb608647-8c32-4a31-b69a-5c23fb84fbea`
- PASS

## HTTPS

- PASS
- Public reachable: PASS

## Verify Token Retrieval Method

- ADMIN_SCRIPT (server-side Python decrypt with AES-256-GCM)
- No token printed in logs
- Token saved to `/tmp/meta-verify-token.txt` with permissions `0600`

## Verify Token Retrieved

- YES

## Token Printed in Logs

- NO

## Cross-tenant Authorization

- NOT_APPLICABLE (admin script, not UI endpoint)
- Future: consider adding authenticated UI action `Copy Verify Token`

## Synthetic GET

- Correct token: `200` + `hub.challenge` (123456)
- Wrong token: `403` + `Forbidden`
- PASS

## Meta Developers Configuration

- App ID to configure: `1783038629742610`
- Callback URL to paste: `https://app.blivcrm.com/api/public/meta-webhook/cb608647-8c32-4a31-b69a-5c23fb84fbea`
- Verify Token to paste: read from `/tmp/meta-verify-token.txt` on the server (`cat /tmp/meta-verify-token.txt`)
- Operator must configure manually in Meta for Developers
- DO NOT configure another App or tenant
- DO NOT share the Verify Token in chat/reports

## Real Meta Get

- NOT_RUN (waiting operator to save callback in Meta Developers)

## last_verified_at

- NOT_UPDATED (will update after real Meta GET)

## Legacy Modified

- NO

## Ready for Real WhatsApp Inbound

- NO (after real Meta GET = YES)

## Ready for Legacy Cleanup

- NO

## Next Steps

1. Operator: `ssh root@103.63.28.182` and run `cat /tmp/meta-verify-token.txt`.
2. In Meta for Developers (App `1783038629742610`):
   - Callback URL: `https://app.blivcrm.com/api/public/meta-webhook/cb608647-8c32-4a31-b69a-5c23fb84fbea`
   - Verify Token: value from `/tmp/meta-verify-token.txt`
   - Save.
3. Monitor `docker compose logs app -f` for the real GET from Meta.
4. After `REAL_META_GET = PASS`, delete `/tmp/meta-verify-token.txt` and proceed to real WhatsApp inbound test.
