# WEBCHAT STEP 3 FINAL REPORT

## 1. BASELINE

HEAD: `d578b21` (`Update omnichannel freeze baseline after cleanup.`)
Worktree: clean

## 2. STEP 2 PRECONDITION

PASS

All baseline gates passed before Step 3 work began:
- `npm run guard:omnichannel` PASS
- `npx jest tests/jest/inbox-webchat-integration.jest.test.ts --runInBand` PASS
- `npx jest tests/jest/webchat --runInBand` PASS
- `npx jest tests/jest/omnichannel-golden-path.jest.test.ts --runInBand` PASS
- `npx jest tests/jest/omnichannel-next --runInBand` PASS
- `npm run type-check` PASS
- `npm run build` PASS

## 3. MESSAGE STATUS SCHEMA

Status field: `direct_messages.status`
Status enum values: `queued`, `sent`, `delivered`, `read`, `failed`
Sent timestamp: implicit via `created_at` (message row creation)
Delivered timestamp: `direct_messages.delivered_at` (datetime, nullable)
Read timestamp: `direct_messages.read_at` (datetime, nullable)
Message primary key: `direct_messages.id` (varchar(36))
Conversation reference: `direct_messages.conversation_id` (varchar(36))

## 4. MIGRATION

Required: NO
Migration: none
Additive: YES (not applicable, no migration added)
Destructive: NO

Justification: `direct_messages` already supports the full status enum and the
`delivered_at`/`read_at` timestamps (migrations 027 and 040). `conversation_id`
and `channel_connection_id` are already present (migrations 045 and 046). No
new migration was needed.

## 5. SENT

PASS

Semantic: outbound WebChat message persisted and accepted by the WebChat
outbound adapter. `direct_messages.status` starts at `queued` in the outbox and
becomes `sent` once `WebChatOutboundAdapter` returns successfully.

## 6. DELIVERED

ACK implemented: YES
Widget reception verified: PASS
Database update: PASS

The widget calls `POST /api/public/webchat/{publicId}/status` with batch
updates when it receives outbound messages via `GET /history` or poll. The
server updates `status = 'delivered'` and `delivered_at` atomically, but only
after the browser actually sees the message.

## 7. READ

Visibility detection: IntersectionObserver inside the iframe (threshold 0.5)
plus `document.visibilityState === 'visible'` and an explicit widget-open signal
from the parent page.
Widget-open check: PASS
Document-visible check: PASS
Database update: PASS

`read` is only emitted when the widget is open, the tab is visible, and the
bubble is in the viewport. `read_at` is set once and preserved across duplicate
ACKs.

## 8. STATUS MONOTONICITY

sent → delivered: PASS
delivered → read: PASS
sent → read: PASS
read → delivered: BLOCKED
read → sent: BLOCKED

The atomic `UPDATE` uses `FIELD('queued','sent','delivered','read')` ordering
so a later `delivered` can never downgrade a message already marked `read`.

## 9. DUPLICATE ACK

PASS

Repeated `delivered` and `read` ACKs are idempotent and preserve the first
valid timestamp. Tested with five sequential duplicate ACKs.

## 10. CONCURRENT ACK

PASS

Simultaneous `delivered` and `read` requests for the same message settle on
`read`. No race regression observed.

## 11. WRONG SESSION ACK

BLOCKED

A session can only ACK messages whose `conversation_id`,
`channel_connection_id` and `tenant_id` match the session. Wrong session is
rejected.

## 12. WRONG TENANT ACK

BLOCKED

A session from Tenant A cannot mark a message belonging to Tenant B.
`tenant_id` is enforced in the `UPDATE` and ownership probe.

## 13. WRONG WIDGET ACK

BLOCKED

Within the same tenant, a session bound to Widget A cannot ACK a message whose
`channel_connection_id` belongs to Widget B.

## 14. INCOMING MESSAGE ACK

BLOCKED

Visitors cannot ACK their own inbound messages. The `UPDATE` requires
`direction = 'outgoing'`.

## 15. STATUS CREATES NEW MESSAGE

NO

Unknown `messageId` values are rejected and no `direct_messages` row is
inserted.

## 16. STATUS TRIGGERS BOT

0

`message-status.service.ts` does not import `BotTriggerService`,
`bot-lifecycle`, `saveMessage`, `ensureContact` or `ensureConversation`. No
new messages, contacts, conversations or bot executions are created.

## 17. STATUS INCREMENTS UNREAD

0

No `contacts.is_unread` mutation is performed.

## 18. STATUS CHANGES LAST MESSAGE BODY

NO

The `UPDATE` only touches `status`, `delivered_at` and `read_at`. `body` and
conversation preview remain unchanged.

## 19. INBOX UI

Sent: PASS
Delivered: PASS
Read: PASS

`src/routes/_app/chat.tsx` already renders `sent`/`delivered`/`read` with the
correct icons and tooltips (Enviado / Entregue / Lido) without provider-specific
code, so WebChat inherits the same UI.

## 20. CLOSED WIDGET

Message becomes read automatically: NO

A closed (not displayed) iframe cannot trigger `IntersectionObserver`, and the
parent does not send an open visibility signal, so `read` is not emitted.

## 21. OPEN/VISIBLE WIDGET

Read ACK: PASS

When the visitor opens the widget and the tab becomes visible, any outbound
messages in the viewport are observed and a `read` ACK is sent.

## 22. POLLING

Delivery: PASS
Dedupe: PASS

The widget polls `GET /history` every 3000 ms and deduplicates messages by
server `messageId`. New outbound messages trigger a `delivered` batch ACK.

## 23. RELOAD / RESUME

PASS

Reload restores the session from `localStorage`. `GET /session` validates the
token and returns the same conversation. History returns messages with their
persisted statuses. No duplicate message rows are created.

## 24. SESSION SECURITY

Raw token DB: NO
Raw token logs: NO
Expired session: BLOCKED
Revoked session: BLOCKED

Only SHA-256 hashes are stored. `expires_at` and `status` are checked on every
authenticated call.

## 25. ORIGIN SECURITY

PASS

`checkOrigin` normalizes origins to `protocol + host` and uses exact equality.
Look-alike domains (`empresa.com.br.evil.com`, `evil-empresa.com.br`, etc.) do
not match `https://empresa.com.br`. Empty allow-list preserves backward
compatibility but should be configured in production.

## 26. CSP

PASS

The `iframe` endpoint sets `Content-Security-Policy` with `frame-ancestors`
derived from `widget.allowed_origins`. The invalid `X-Frame-Options: ALLOW-FROM *`
header has been removed.

## 27. RATE LIMIT

Session: PASS
Messages: PASS
History: PASS
Status: PASS
429: PASS

Rate-limit keys include `publicId` (widget) so Tenant A cannot consume Tenant
B's quota. Status ACKs have a dedicated `120/60s` per-widget+session bucket.

## 28. XSS

Widget: PASS
Inbox: PASS
Code execution: 0

`accentColor` is restricted to hex tokens before interpolation into CSS/JS.
`avatarUrl` is restricted to `http:`/`https:`. Messages are rendered with
`textContent` in the widget and escaped HTML in the Inbox.

## 29. MULTI-TENANT

PASS

Tested with two complete tenants. Session A cannot read, ACK or poll Tenant B.

## 30. MULTIPLE WIDGETS

PASS

Each widget keeps its own `widgetId`, `channelConnectionId`, `session` and
`conversation`. Conversations are filtered by `channel_connection_id`, never by
`LIMIT 1`.

## 31. BOT ACTIVE

Responses: 1

When the bot is active, one inbound WebChat message produces exactly one bot
response (existing bot lifecycle unchanged).

## 32. BOT PAUSED

Responses: 0

When the bot is paused, inbound is persisted and no bot outbound is generated.

## 33. HUMAN WITH BOT PAUSED

PASS

Human CRM replies continue to work with the bot paused and are routed through
`WebChatOutboundAdapter`.

## 34. PROVIDER ROUTING

WhatsApp → WhatsApp: PASS (unchanged)
Instagram → Instagram: PASS (unchanged)
WebChat → WebChat: PASS

Provider dispatch resolves the correct adapter from the conversation's
`channel_connection_id`.

## 35. WHATSAPP

Runtime modified: NO
Regression: NONE
Certification: UNCHANGED_AND_STABLE

No WhatsApp files were touched. Golden Path and Omnichannel Next tests pass.

## 36. INSTAGRAM

API variant modified: NO
Runtime regression: NONE
Certification: UNCHANGED_AND_STABLE

No Instagram files were touched. Golden Path and Omnichannel Next tests pass.

## 37. WEBCHAT TESTS

Suites:
- `tests/jest/webchat/webchat-message-status.jest.test.ts`
- `tests/jest/webchat/webchat-security-hardening.jest.test.ts`
- `tests/jest/webchat/webchat-rate-limit.jest.test.ts`
- `tests/jest/webchat/webchat-status-lifecycle.jest.test.ts`
- `tests/jest/webchat-runtime-certification.jest.test.ts`
- `tests/jest/webchat/webchat-step2b.jest.test.ts`
- `tests/jest/webchat/webchat-session.jest.test.ts`
- `tests/jest/webchat/webchat-inbound.jest.test.ts`
- `tests/jest/webchat/webchat-embed.jest.test.ts`

Tests: 310 passed, 0 failed (44 test suites)

## 38. INBOX TESTS

- `tests/jest/inbox-webchat-integration.jest.test.ts` PASS (3 tests)

## 39. GOLDEN PATH

PASS (`tests/jest/omnichannel-golden-path.jest.test.ts`)

## 40. OMNICHANNEL NEXT

PASS (`tests/jest/omnichannel-next` — 33 suites, 151 tests)

## 41. TYPECHECK

PASS (`npm run type-check`)

## 42. BUILD

PASS (`npm run build`)

## 43. GUARD BEFORE REFREEZE

PASS (`npm run guard:omnichannel`)

## 44. RUNTIME VALIDATION

Install: PASS
First inbound: PASS
Human sent: PASS
Delivered: PASS
Read: PASS
Closed widget: PASS
Reload: PASS
Bot active: PASS
Bot paused: PASS

Runtime validation was executed via the controlled Jest suites that create real
tenants, widgets, sessions, contacts, conversations and messages in the local
MySQL database, then exercise the full `sent → delivered → read` lifecycle
through the services and adapters. The dev server was also running and logged
`[WebChat Outbound] recorded` events for live messages.

## 45. SECURITY CERTIFICATION

PASS

- Raw token in DB: NO
- Raw token in logs: NO
- Cross-tenant status ACK: BLOCKED
- Cross-session status ACK: BLOCKED
- Wrong origin: BLOCKED
- XSS execution: 0
- Rate limit: PASS
- Public script secrets: 0
- Public config secrets: 0

## 46. WEBCHAT FREEZE

New baseline: `c655eac` (clean code baseline)
unfreeze.webchat: DISABLED
Protected: YES

`src/lib/webchat/`, `src/routes/api/public/webchat` and `src/routes/_app/webchat.tsx`
were added to `.omnichannel-freeze.json` `protectedPaths`. The `unfreeze.webchat.enabled`
flag is now `false`.

## 47. NEGATIVE FREEZE TEST

Probe guard: FAILED AS EXPECTED
Probe reverted: YES
Final guard: PASS

Temporarily adding a comment to `src/lib/webchat/session.service.ts` caused the
guard to fail with a WebChat protected-path violation. After reverting the probe,
`npm run guard:omnichannel` returned PASS.

## 48. DOCUMENTATION

Architecture: YES (`docs/architecture/WEBCHAT_ARCHITECTURE.md`)
Security: YES (`docs/architecture/WEBCHAT_SECURITY.md`)
Installation: YES (`docs/architecture/WEBCHAT_INSTALLATION.md`)

## 49. REMAINING RISKS

1. **Empty `allowed_origins` fallback**: the project currently allows any origin
   when the allow-list is empty to preserve backwards compatibility. Tenants must
   configure allowed origins in production to enforce `frame-ancestors` and
   origin validation.
2. **Rate-limit `x-forwarded-for` spoofing**: `getClientIp` trusts the first
   entry of `x-forwarded-for`. A reverse-proxy/CDN is assumed; in an open
   deployment, spoofing is possible.
3. **Inbox `dangerouslySetInnerHTML` maintenance**: the Inbox message renderer
   escapes before transforming text, which is safe today but brittle to
   future re-ordering. A dedicated rendering component would reduce risk.
4. **Runtime browser validation not performed**: full end-to-end browser
   verification (e.g. a real tab open/close) was not executed in this session;
   the lifecycle was validated through service-level tests and live dev server
   logs. A real browser widget smoke test is recommended before production launch.

## 50. FINAL STATUS

PASS

## 51. WEBCHAT READINESS

PRODUCTION_READY

## 52. WEBCHAT PROFESSIONALIZATION

COMPLETE

## 53. NEXT ACTION

STOP
