# OMNICHANNEL NEXT — SHADOW CONTRACT PARITY REPORT

> Step 7 — Shadow Execution Harness + Contract Parity
> Current runtime remains frozen. No real network. No real credentials. No production cutover.

## Method

Each provider was audited in three layers:

1. **Current runtime** — static source audit of `src/lib/messaging/outbound/adapters/` and `src/lib/chat-outbox.server.ts`.
2. **Omnichannel Next** — executed through `MetaWhatsAppTransport` and `MetaInstagramTransport` with `FakeHttpClient` and `FakeCredentialResolver`.
3. **Shadow comparison** — `SafeOutboundContractDescriptor` for both sides, then field-by-field semantic diff.

## Official Meta Sources

- WhatsApp Cloud API text messages: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages/
- Instagram Messaging API send messages: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/

## Current Runtime Audit — WhatsApp

| Field | Value | Provenance |
|-------|-------|------------|
| API variant | WhatsApp Cloud API | `src/lib/messaging/outbound/adapters/whatsapp.api.ts` |
| Method | `POST` | `whatsapp.api.ts` |
| Host | `graph.facebook.com` | `whatsapp.api.ts` |
| Graph version source | `recentMetaVersion()` clamp v24-v26, default `v26.0` | `whatsapp.outbound-adapter.ts` |
| Sender node type | `phone_number_id` | `whatsapp.outbound-adapter.ts` (`channel.externalAccountId`) |
| Sender source | `channel_connections.external_account_id` | `whatsapp.outbound-adapter.ts` |
| Recipient type | E.164 phone number | `whatsapp.payload-builder.ts` |
| Text payload | `{ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body, preview_url } }` | `whatsapp.payload-builder.ts` |
| Authorization | `Bearer <resolved token>` | `whatsapp.api.ts` |
| Response ID path | `messages[0].id` | `whatsapp.api.ts` |
| Success semantics | `sent` | `whatsapp.outbound-adapter.ts` status |

## Next — WhatsApp

| Field | Value | Provenance |
|-------|-------|------------|
| API variant | WhatsApp Cloud API | `MetaWhatsAppTransport` |
| Method | `POST` | executed mock |
| Host | `graph.facebook.com` | executed mock |
| Graph version source | explicit `graphApiVersion` transport config | executed mock |
| Sender node type | `phone_number_id` | `MetaWhatsAppTransport` (`request.sender`) |
| Sender source | channel config resolved via `WhatsAppChannelConfigPort` | `WhatsAppProvider` |
| Recipient type | E.164 phone number | executed mock |
| Text payload | `{ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body, preview_url: false } }` | executed mock |
| Authorization | `Bearer <resolved token>` | executed mock |
| Response ID path | `messages[0].id` | `MetaWhatsAppTransport` |
| Success semantics | `accepted` | `ProviderWorker` design |

## WhatsApp Parity Verdict

- **Overall**: `INTENTIONAL_IMPROVEMENT`
- **Risk**: `LOW`
- **Cutover readiness**: `SHADOW_READY`

Differences:

1. **Graph version source**: current clamps to v24-v26; Next uses explicit config.
   - Classification: `EXPECTED_ARCHITECTURAL_DIFFERENCE`
   - Risk: `LOW`
   - Explanation: equivalent if the same version is configured. Next is more explicit and testable.

2. **Success semantics**: current labels HTTP 200 as `sent`; Next uses `accepted`.
   - Classification: `INTENTIONAL_IMPROVEMENT`
   - Risk: `LOW`
   - Explanation: `accepted` is semantically correct. `sent`/`delivered`/`read` must come from webhooks.

All other fields match: method, host, sender type, recipient type, payload shape, response ID path, authorization scheme.

## Current Runtime Audit — Instagram

| Field | Value | Provenance |
|-------|-------|------------|
| API variant | graph.facebook.com with `MESSAGE_TYPE=RESPONSE` | `src/lib/messaging/outbound/adapters/instagram.api.ts` |
| Method | `POST` | `instagram.api.ts` |
| Host | `graph.facebook.com` | `instagram.api.ts` |
| Graph version source | `process.env.META_GRAPH_VERSION` or `v26.0` | `instagram.api.ts` |
| Sender node type | `ig_user_id` | `instagram.outbound-adapter.ts` (`channel.externalAccountId`) |
| Sender source | `channel_connections.external_account_id` | `instagram.outbound-adapter.ts` |
| Recipient type | `ig_scoped_id` (IGSID) | `instagram.payload-builder.ts` |
| Page ID role | not used as sender node | `instagram.outbound-adapter.ts` uses `externalAccountId` directly |
| IG User ID role | sender node | `instagram.api.ts` (`igUserId`) |
| Text payload | `{ recipient: { id }, message_type: "RESPONSE", message: { text } }` | `instagram.payload-builder.ts` |
| HUMAN_AGENT default | NO for normal text | `instagram.outbound-adapter.ts` `useHumanAgentTag: false` |
| MESSAGE_TAG default | NO for normal text | same as above |
| Authorization | `Bearer <resolved token>` | `instagram.api.ts` |
| Response ID path | `message_id` | `instagram.api.ts` |
| Success semantics | `sent` | `instagram.outbound-adapter.ts` status |

## Next — Instagram

| Field | Value | Provenance |
|-------|-------|------------|
| API variant | Instagram Messaging API with Instagram Login | `MetaInstagramTransport` |
| Method | `POST` | executed mock |
| Host | `graph.instagram.com` | executed mock |
| Graph version source | explicit `graphApiVersion` transport config | executed mock |
| Sender node type | `ig_user_id` | `MetaInstagramTransport` (`request.sender`) |
| Sender source | channel config resolved via `InstagramChannelConfigPort` | `InstagramProvider` |
| Recipient type | `ig_scoped_id` (IGSID) | executed mock |
| Page ID role | not used as sender node | `MetaInstagramTransport` design |
| IG User ID role | sender node | `MetaInstagramTransport` |
| Text payload | `{ recipient: { id }, message: { text } }` | executed mock |
| HUMAN_AGENT default | NO | `MetaInstagramTransport` design |
| MESSAGE_TAG default | NO | `MetaInstagramTransport` design |
| Authorization | `Bearer <resolved token>` | executed mock |
| Response ID path | `message_id` | `MetaInstagramTransport` |
| Success semantics | `accepted` | `ProviderWorker` design |

## Instagram Parity Verdict

- **Overall**: `API_VARIANT_DIFFERENCE`
- **Risk**: `HIGH`
- **Cutover readiness**: `BLOCKED` until variant is explicitly selected

Differences:

1. **Host**: current `graph.facebook.com`; Next `graph.instagram.com`.
   - Classification: `API_VARIANT_DIFFERENCE`
   - Risk: `HIGH`
   - Explanation: different hosts imply different API variants. A cutover must pick one and validate it.

2. **Payload body**: current includes `message_type: "RESPONSE"`; Next omits it.
   - Classification: `API_VARIANT_DIFFERENCE`
   - Risk: `HIGH`
   - Explanation: Messenger-style `RESPONSE` messaging type is required for the Facebook-linked variant. Instagram Login variant uses a different contract.

3. **Graph version source**: current reads env/default; Next uses explicit config.
   - Classification: `EXPECTED_ARCHITECTURAL_DIFFERENCE`
   - Risk: `LOW`

4. **Success semantics**: current `sent` vs Next `accepted`.
   - Classification: `INTENTIONAL_IMPROVEMENT`
   - Risk: `LOW`

No `HUMAN_AGENT` or `MESSAGE_TAG` in either side for normal text — confirmed MATCH on that point.

## Identifier Semantics

| Concern | Current | Next |
|---------|---------|------|
| Channel canonical identity | `channel_connections.external_account_id` | same `external_account_id` (not used as sender) |
| Graph sender node WA | `phone_number_id` | `phone_number_id` |
| Graph sender node IG | `ig_user_id` | `ig_user_id` |
| WA recipient | E.164 phone | E.164 phone |
| IG recipient | `IGSID` | `IGSID` |
| `external_account_id` used blindly as Graph node | YES for both | NO (explicitly mapped to provider-specific identity) |

## Credential Resolution Parity

- Current: `resolveChannelAccessToken(channel)` inside outbound adapter.
- Next: `CredentialResolverPort` resolved at `MetaWhatsAppTransport` / `MetaInstagramTransport`.
- Plaintext token never appears in `OutboundJob`, queue, or application layers in Next.

## Status Semantics Parity

- Current: `sent` after HTTP 200.
- Next: `accepted` after HTTP 200; delivery/read through future webhooks.
- Next is architecturally clearer.

## Error Handling Parity

- Current WA: raw status + body in `WhatsAppClientError`.
- Current IG: retries up to 3 times on 429/5xx/network errors; raw status + body.
- Next: one attempt; normalized `safeCode` (`META_WHATSAPP_<status>`, `META_INSTAGRAM_<status>`); `retryable` flag; retry belongs to queue, not transport.
- Next is an intentional architectural improvement.

## Migration Risks

- **WhatsApp**: `LOW` risk. Structure matches. Cutover possible after explicit Graph version config and credential resolver are ready.
- **Instagram**: `HIGH` risk. API variant must be selected and proven against real accounts before cutover. The current and Next contracts use different hosts/payloads.

## Cutover Blockers

- **Instagram**: `API variant not selected`.
- **Instagram**: `Host/payload divergence not resolved`.
- **WhatsApp**: none for contract-only cutover.

## Intentional Next Improvements

1. Explicit status semantics (`accepted` instead of `sent`).
2. Transport-level error normalization.
3. Retry responsibility moved to queue/worker.
4. Explicit sender node identity (no `external_account_id` blind use).
5. No `HUMAN_AGENT`/`MESSAGE_TAG` by default for Instagram text.

## Conclusion

- **WhatsApp** is `SHADOW_READY` for future Step 8 (real credential / channel config resolution).
- **Instagram** is `BLOCKED` until the API variant is explicitly chosen and the current runtime behavior is reproduced or intentionally superseded.
- No protected runtime files were modified.
- No real Meta traffic was generated.
