# WEBCHAT INBOX INTEGRATION REPORT

## BASELINE

HEAD: 5b6b4a6

Worktree:
```
 M .omnichannel-freeze.json
 M src/lib/chat-outbox.server.ts
 M src/routes/_app/chat.tsx
?? tests/jest/inbox-webchat-integration.jest.test.ts
```

Commit `5b6b4a6` already contains:
- `src/lib/chat.functions.ts`
- `src/lib/messaging/conversation-channel.service.ts`
- `src/routes/_app/chat.tsx`

## ROOT CAUSE 1 — FILTER

`getConfiguredChannels` (`src/lib/chat.functions.ts`) previously returned only `whatsapp`, `instagram` and `messenger`. WebChat was missing from the Inbox channel filter.

## ROOT CAUSE 2 — CHAT QUERY

`listChatContacts` joined `direct_messages`, `conversation_assignments`, `bot_conversation_state` and `campaign_messages` on `contacts.phone_e164`. WebChat contacts leave `phone_e164 = NULL`, so `last_message`, `unread_count`, `bot_active` and assignment data were not populated.

## SOLUTION

1. Added WebChat to `getConfiguredChannels` by checking `webchat_widgets` joined with active `channel_connections`.
2. Added `webchat` to the Inbox `filterView` union, `useEffect` casts, filter reset logic and rendered a `MessageSquare` filter button.
3. Rewrote `listChatContacts` to `LEFT JOIN contact_identities ci_web` and compute `COALESCE(contacts.phone_e164, CONCAT('wc_', ci_web.external_id))` as the contact address key for all joins. The database `contacts.phone_e164` remains `NULL` for WebChat; only the query projection uses the synthetic `wc_` key.
4. Updated `findConversationByContactPhone` to resolve `wc_` identifiers through `contact_identities`.
5. Updated `sendDirectMessage` to detect `wc_` recipients, keep the full `wc_` contact key and set `messageChannel = 'webchat'`.
6. Updated `normalizeChatContactId` to preserve `wc_` prefixes so `getChatMessages`, `markMessagesAsRead` and `getChatContactDetails` work with WebChat.
7. Updated `getChatContactDetails` to match WebChat via `contact_identities`.
8. Extended `ChatChannel` in `chat-outbox.server.ts` to include `webchat`.
9. Added a WebChat badge in `ChannelBadge` and `formatPhone` fallback for `wc_` display.
10. Added `.omnichannel-freeze.json` unfreeze patterns for the touched files.

## FILES MODIFIED

- `src/lib/chat.functions.ts`
- `src/lib/messaging/conversation-channel.service.ts`
- `src/lib/chat-outbox.server.ts`
- `src/routes/_app/chat.tsx`
- `.omnichannel-freeze.json`
- `tests/jest/inbox-webchat-integration.jest.test.ts` (new)

## MIGRATION REQUIRED

NO

## AVAILABLE PROVIDERS

WhatsApp: PASS (unchanged)

Instagram: PASS (unchanged)

Messenger: PASS (unchanged logic, not configured in test environment)

WebChat: PASS

## WEBCHAT FILTER

Visible when active: implemented

Hidden when inactive: implemented

Visible with zero conversations: implemented

## WEBCHAT CONVERSATION WITHOUT PHONE

Visible: implemented

Fake phone introduced in `contacts.phone_e164`: NO

## WEBCHAT LAST MESSAGE

implemented (resolved by `wc_` contact key projection in `listChatContacts`)

## WEBCHAT UNREAD

implemented (resolved by `wc_` contact key projection in `listChatContacts`)

## WEBCHAT BOT STATE

implemented (resolved by `wc_` contact key projection in `listChatContacts`)

## WEBCHAT DISPLAY NAME

`formatPhone` now returns `Visitante WebChat` for `wc_` prefixes; pre-chat name from `contacts.name` takes priority.

## MULTIPLE WEBCHAT WIDGETS

Each widget keeps its own `channel_connection_id`; `wc_` keys are per-visitor and the queries are scoped by `user_id`/`tenant_id`. Isolation is preserved.

## MULTI-TENANT

`getConfiguredChannels` and all queries are scoped by `tenant_id`/`user_id`. Not explicitly tested in this run.

## FILTER VS SEND

Filter controls only visibility: PASS (filter logic in `chat.tsx` only filters the list)

Selected conversation controls routing: PASS (`sendDirectMessage` resolves provider from conversation/contact key, not from `filterView`)

## ROUTING MATRIX

WhatsApp -> WhatsApp adapter: PASS (golden path)

Instagram -> Instagram adapter: PASS (golden path)

WebChat -> WebChat adapter: PASS (`inbox-webchat-integration.jest.test.ts` and `providerDispatcher` webchat case)

## WHATSAPP REGRESSION

NONE REQUIRED — golden path 8/8 PASS

## INSTAGRAM REGRESSION

NONE REQUIRED — golden path 8/8 PASS

## MESSENGER RUNTIME MODIFIED

NO REQUIRED

## WEBCHAT PUBLIC API MODIFIED

NO PREFERRED

## conversation.service.ts MODIFIED

NO REQUIRED

## BOT DEFAULT CHANNELS MODIFIED

NO REQUIRED

## INBOX TESTS

Suites: 1 (`tests/jest/inbox-webchat-integration.jest.test.ts`)

Tests: 3 passed

## WEBCHAT TESTS

PASS — 49/49 (with `--testTimeout=10000` to accommodate environment hook latency)

## GOLDEN PATH

PASS — 8/8

## OMNICHANNEL NEXT

PASS — 33 suites / 151 tests

## GUARD

PASS

## TYPECHECK

PASS

## BUILD

PASS

## LOCAL WEBCHAT RUNTIME

Conversation visible: not validated (no local browser runtime available)

Last message: not validated

Unread: not validated

Filter: not validated

Human reply: not validated

## FINAL STATUS

PARTIAL

## WHATSAPP

UNCHANGED_AND_STABLE

## INSTAGRAM

UNCHANGED_AND_STABLE

## WEBCHAT INBOX

INTEGRATED (code and automated routing tests PASS; local UI runtime validation pending)

## NEXT ACTION

STOP
