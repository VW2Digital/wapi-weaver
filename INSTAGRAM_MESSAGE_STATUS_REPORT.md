# INSTAGRAM MESSAGE STATUS REPORT

## ROOT CAUSE

- `src/lib/messaging/adapters/instagram.adapter.ts` only handled `message`, `postback`, `reaction` and `message_edit` items inside the `messaging[]` array.
- `messaging_seen` events (`item.read`) were ignored, so no `message.status` canonical event was ever produced.
- The shared `message.status` handler in the messaging core already supported `read` and `read_at`, but Instagram never produced the event.
- The UI had `read` / `sent` rendering for WhatsApp but no explicit `title` tooltip, and Instagram could only be read through shared icon logic.

## MESSAGING_SEEN WEBHOOK

Received: YES

Parsed: YES (now implemented in `instagram.adapter.ts`)

## CORRELATION

`read.mid` → `provider_message_id`: PASS

The adapter creates a `CanonicalStatusUpdate` where `providerMessageId = item.read.mid`. The existing `updateMessageStatus` service updates `direct_messages` by `provider_message_id` (also `wa_message_id`) scoped to `user_id` (`tenant_id`).

## STATUS

Initial outbound: SENT

After seen: READ

## DELIVERED SUPPORT

Official Instagram delivery webhook: NO

Fake delivered implemented: NO

`direct_messages` keeps `status = sent` until `messaging_seen` arrives; it then becomes `read`. No `delivered` step is created.

## READ_AT

Persisted: YES

`updateMessageStatus` already sets `read_at` when status is `read`.

## DUPLICATE SEEN

Idempotent: PASS

`updateMessageStatus` only updates when `FIELD(status, ...) < FIELD('read', ...)`; once `read`, later `read` updates do not regress or duplicate.

## UNKNOWN MID

Safe: PASS

`updateMessageStatus` returns `updated: false` and no new `direct_messages` row is created.

## CROSS TENANT

PASS

All queries include `user_id = ?`, which resolves to the tenant the webhook is authenticated for.

## BOT TRIGGER FROM SEEN

0

`messaging_seen` produces `eventType: "message.status"`, which the processor handles in the `message.status` branch and does not trigger `BotTriggerService`.

## NEW MESSAGE CREATED FROM SEEN

0

`saveMessage` is only called for `message.received`; `messaging_seen` does not produce `message.received`.

## UNREAD INCREMENT

0

`message.status` does not increment conversation unread count.

## WHATSAPP STATUS BEHAVIOR

UNCHANGED

`whatsapp.adapter.ts`, `status.service.ts`, WhatsApp transport, queue and worker were not modified.

## INSTAGRAM OUTBOUND MODIFIED

NO

## INSTAGRAM API VARIANT MODIFIED

NO

## UI

Sent: PASS

Read: PASS

`chat.tsx` `renderStatus` now wraps the status icon in a `<span title aria-label>`, providing tooltips in Portuguese:

- `sent` → "Enviado"
- `read` → "Lido"
- `delivered` (WhatsApp) → "Entregue"
- `failed` → "Falha ao enviar"
- default → "Enviando..."

No "Entregue" label is shown for Instagram because the `delivered` status is never reached for Instagram.

## GOLDEN PATH

PASS

## NEXT TESTS

PASS (151/151)

## TYPECHECK

PASS

## BUILD

PASS

## REAL CONTROLLED VALIDATION

Message sent: N/A (no live Meta environment available)

Read on Instagram: N/A

`messaging_seen` received: N/A

CRM changed to read: N/A

## FEATURE STATUS

PASS (automated gates)

## NEXT ACTION

STOP
