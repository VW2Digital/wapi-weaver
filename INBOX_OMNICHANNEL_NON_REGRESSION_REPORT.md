# INBOX OMNICHANNEL NON-REGRESSION REPORT

> Audit executed on the current `main` branch after the WebChat MVP and UI preview work.  
> No code was modified during this audit.  
> HEAD: `37754fd` | Worktree: CLEAN

---

## 1. BASELINE

### Git

| Item | Value |
|------|-------|
| HEAD | `37754fd` |
| Worktree | `CLEAN` |
| Branch | `main` (up to date with `origin/main`) |

### Relevant commit range (since omnichannel baseline `da17712`)

Baseline: `da1771272a264973c7cf4fff97b80611fac953b8`

Key commits that touch shared messaging / Inbox:

- `dd89296` — feat: initial WebChat provider, schema and settings
- `ab2f210` — feat: WebChat Step 2 functional messaging MVP
- `42d0341` — Implementa formulário pré-chat no WebChat e criação de contato/lead no CRM
- `d099f18` — Adiciona máscaras de e-mail e telefone no pré-chat
- `a21bc14` — Atualiza WidgetPreview para refletir pré-chat e animação
- `6878265` — Adiciona campo de upload de avatar no WebChat
- `857dcc3` — Corrige botão Copiar código do WebChat
- `37754fd` — Update webchat.tsx

### Gate results

| Gate | Result |
|------|--------|
| `npm run type-check` | **PASS** |
| `npm run build` | **PASS** |
| `npm run guard:omnichannel` | **PASS** (baseline `da17712`) |
| `npx jest tests/jest/omnichannel-golden-path.jest.test.ts --runInBand` | **8/8 PASS** |
| `npx jest tests/jest/omnichannel-next --runInBand` | **33 suites / 151 tests PASS** |
| `npx jest tests/jest/webchat --runInBand` | **4 suites / 49 tests PASS** |

---

## 2. CURRENT PROVIDERS

| Provider | Status in registry | Outbound adapter | Inbound adapter | Channel resolution |
|----------|--------------------|------------------|-----------------|-------------------|
| **WhatsApp** | Registered, frozen, stable | `WhatsAppRuntimeAdapter` (`whatsapp.outbound-adapter.ts` / `whatsapp-runtime-adapter.ts`) | `src/lib/messaging/adapters/whatsapp.adapter.ts` | `channel_connections` with token decrypt |
| **Instagram** | Registered, frozen, stable | `InstagramOutboundAdapter` (`instagram.outbound-adapter.ts`) | `src/lib/messaging/adapters/instagram.adapter.ts` | `channel_connections` with token decrypt |
| **Messenger** | Registered in dispatcher | `MessengerOutboundAdapter` (`messenger.outbound-adapter.ts`) | `meta-webhook.$publicId.ts` | `channel_connections` if configured |
| **WebChat** | Registered, recently added | `WebChatOutboundAdapter` (`webchat-outbound-adapter.ts`) | `src/lib/webchat/inbound-message.service.ts` | `webchat_sessions` / `webchat_widgets` |

---

## 3. FREEZE STATUS

- WhatsApp: **FROZEN** (protected paths cover `src/lib/messaging/outbound/adapters/whatsapp/`, `src/lib/whatsapp*`, `src/routes/api/public/whatsapp*`, etc.).
- Instagram: **FROZEN** (protected paths cover `src/lib/instagram*`, `src/routes/api/public/instagram*`, `src/lib/messaging/webhook-handlers/`, etc.).
- WebChat: **UNFROZEN** in `.omnichannel-freeze.json` under `unfreeze.webchat` (since `CONTROLLED_WEBCHAT_UNFREEZE`) with explicit patterns including `database/migrations/054_webchat.sql` and the new `055_webchat_avatar.sql`.

`npm run guard:omnichannel` **PASS** on the current worktree.

---

## 4. INBOX ARCHITECTURE

```
DB
 ├─ channel_connections (provider, access_token_encrypted, status)
 ├─ chat_sessions (id, contact_id, channel_connection_id, closed_at)
 ├─ contacts (id, user_id/tenant_id, phone_e164, channel, custom_fields, ...)
 ├─ direct_messages (conversation_id, channel_connection_id, contact_phone, channel, direction, status, ...)
 └─ webchat_widgets / webchat_sessions (tenant + session)

Inbox query
 └─ src/lib/chat.functions.ts → listChatContacts
    └─ SELECT * FROM contacts c ... LEFT JOIN direct_messages, chat_sessions, etc.

DTO / normalize
 └─ src/routes/_app/chat.tsx

Filter state
 └─ chat.tsx: filterView ("all" | "whatsapp" | "instagram" | "messenger" | ...)

Conversation selection
 └─ selectedContact (contact row with c.channel)

Messages
 └─ getChatMessages (key: selectedPhone / contact_phone)

Send action
 └─ sendDirectMessage → resolve conversation → chat-outbox.server.ts
    → provider-dispatcher.ts → provider-specific adapter
```

---

## 5. PROVIDER SOURCE OF TRUTH

### For channel / outbound routing

The canonical source is `channel_connections.provider`.

1. `chat_sessions.channel_connection_id` is set from the inbound adapter or resolved at send time.
2. `resolveConversationChannel()` (`src/lib/messaging/conversation-channel.service.ts:26`) reads `chat_sessions` and then `channel_connections`.
3. `sendDirectMessage` (`src/lib/chat.functions.ts:860`) resolves `resolvedChannel.provider` from that chain.
4. `ProviderDispatcher.dispatch()` uses the resolved `context.provider` to pick the adapter.

### For Inbox conversation list / filter badge

The UI uses `contacts.channel` (`listChatContacts` selects `c.channel`). This is set when the contact is first created by `contact-identity.service.ts` with the provider value (`whatsapp`, `instagram`, `messenger`, `webchat`).

**Verdict:** Provider is derived from `channel_connections` for routing and from `contacts.channel` for display/filtering. These are aligned as long as `contacts.channel` is written correctly at identity creation.

---

## 6. AVAILABLE PROVIDER SOURCE

### `getConfiguredChannels` (`src/lib/chat.functions.ts:1193`)

Current implementation checks legacy configuration tables:

- WhatsApp: `profiles.whatsapp_phone_number_id IS NOT NULL`
- Instagram: `instagram_accounts.access_token` + `instagram_business_account_id`
- Messenger: `facebook_pages.page_access_token` + `page_id`

It **does not query `channel_connections` and it does not include `webchat_widgets`**.

```ts
return {
  channels: [
    "all",
    ...(whatsappRows.length > 0 ? ["whatsapp"] : []),
    ...(instagramRows.length > 0 ? ["instagram"] : []),
    ...(messengerRows.length > 0 ? ["messenger"] : []),
  ],
};
```

**Finding:** The `webchat` provider filter is **not exposed in the Inbox** because `getConfiguredChannels` does not return it. The Inbox UI also has no `filterView === "webchat"` branch (`src/routes/_app/chat.tsx` lines `3425-3428`).

---

## 7. FILTER STATE

- `availableProviders` (front-end): `getConfiguredChannels` data (`all`, `whatsapp`, `instagram`, `messenger`). WebChat missing.
- `selectedFilter` (front-end): `filterView` state. Only affects `rawFilteredContacts` in `chat.tsx:3411`.
- `selectedConversation`: `selectedContact` (a contact row). Contains `channel`, `phone_e164`, `id`.
- `routing provider` for send: derived from `selectedContact.phone_e164` → `chat_sessions.channel_connection_id` → `channel_connections.provider`.

**Finding:** `filterView` is **not used** for send, bot, or outbound routing. It only controls list visibility. This is correct.

---

## 8. FILTERS

| Filter | Current behavior | Result |
|--------|------------------|--------|
| **All** | Always visible | **PASS** |
| **WhatsApp** | Visible when `profiles.whatsapp_phone_number_id` exists; filters `contact.channel === "whatsapp"` | **PASS** (legacy config detection) |
| **Instagram** | Visible when `instagram_accounts` is configured; filters `contact.channel === "instagram"` | **PASS** (legacy config detection) |
| **Messenger** | Visible when `facebook_pages` is configured; filters `contact.channel === "messenger"` | **PASS** (legacy config detection) |
| **WebChat** | **Not implemented** — missing from `getConfiguredChannels` and `filterView` enum | **FAIL / NOT PRESENT** |

---

## 9. FILTER DOES NOT CONTROL SEND

**Result: PASS**

`sendDirectMessage` receives only the recipient phone (`to`) and message payload. It resolves the channel from `chat_sessions`/`channel_connections`. `filterView` is not passed to the send mutation or to `chat-outbox.server.ts`. Outbound dispatch uses `context.provider` from the resolved channel.

---

## 10. WHATSAPP

| Concern | Result | Notes |
|---------|--------|-------|
| Inbound | **PASS** | `whatsapp.adapter.ts` builds `provider: "whatsapp"`, `external_id: wa_id`, `phoneE164: normalized phone`. Identity isolated. |
| Inbox display | **PASS** | `contacts.channel` = `"whatsapp"`; `ChannelBadge` green; `formatPhone` handles E.164. |
| Identity | **PASS** | `contact_identities` keyed by `(user_id, provider, external_id)` where `provider = "whatsapp"`. No merge with Instagram/WebChat. |
| Outbound routing | **PASS** | `WhatsAppRuntimeAdapter` rejects `context.provider !== "whatsapp"`; dispatcher resolved by `channel_connections.provider`. |
| Next runtime preserved | **YES** | `omnichannel-golden-path` and `omnichannel-next` tests confirm queue isolation, token decrypt, and sequential/parallel WA/IG. |
| Shared changes affecting WA | **NONE observed** | WebChat added branches without changing WA-specific code. |

---

## 11. INSTAGRAM

| Concern | Result | Notes |
|---------|--------|-------|
| Inbound | **PASS** | `instagram.adapter.ts` builds `provider: "instagram"`, `external_id: IGSID`, `phoneE164: null`. Identity isolated. |
| Inbox display | **PASS** | `contact.channel` = `"instagram"`; `ChannelBadge` pink; `resolveContactDisplayName` uses `instagram_profile_name` or `@username`. |
| Identity | **PASS** | `external_id = IGSID`; `phoneE164` synthetic `ig_<IGSID>` is used for `contacts` lookup but `contact_identities` stays by `(provider, external_id)`. |
| Profile name | **PASS** | `contact-display.service.ts` Instagram branch preserved. |
| Avatar | **PASS** | Enrichment path unchanged; `avatar_url` stored in `custom_fields` for Instagram. |
| Outbound routing | **PASS** | `InstagramOutboundAdapter` rejects `context.provider !== "instagram"`. |
| API variant changed | **NO** | Test suite and adapter still use Instagram Graph `v26.0` endpoint. |
| Shared changes affecting IG | **NONE observed** | WebChat branches do not modify Instagram logic. |

---

## 12. WEBCHAT

| Concern | Result | Notes |
|---------|--------|-------|
| Provider isolation | **PASS** | Inbound uses `provider: "webchat"`; identity `external_id: visitorId`; `phoneE164: null`. No fake phone in `phone_e164`. `contact_phone` in `direct_messages` is `wc_${visitorId}`. |
| Session | **PASS** | `webchat_sessions` scoped to `tenant_id` + `widget_id`. |
| Inbound | **PASS** | Jest `webchat-inbound` passes; no Meta credential used. |
| Inbox | **FAIL** | `listChatContacts` joins `direct_messages.contact_phone` and `bot_conversation_state.contact_number` with `contacts.phone_e164`. WebChat `contacts.phone_e164` is `NULL`, so `last_message`, `unread_count`, and `bot_active` will not populate for WebChat conversations. |
| Outbound | **PASS** | `WebChatOutboundAdapter` no-op records the message. Dispatched by `provider === "webchat"`. |
| Bot | **PASS** | Bot branches are additive (`channel === "webchat"`); WA/IG branches untouched. |
| History | **PASS** | `history.service.ts` scopes to tenant + channel_connection + conversation. |

---

## 13. MESSENGER

- Configuration status: relies on `facebook_pages` legacy table; no `channel_connections` integration observed.
- Inbox filter: present when `facebook_pages` is configured.
- Runtime: `MessengerOutboundAdapter` exists but Messenger is not fully implemented in the active omnichannel-next container.
- **No new modifications requested during this audit.**

---

## 14. PROVIDER REGISTRY

`src/lib/messaging/outbound/provider-dispatcher.ts` and `provider-registry.ts`:

- `whatsapp` → `WhatsAppRuntimeAdapter`
- `instagram` → `InstagramOutboundAdapter`
- `messenger` → `MessengerOutboundAdapter`
- `webchat` → `WebChatOutboundAdapter`
- **Unknown provider → throws `UnsupportedProviderError`** (fail-closed).

**Verdict: PASS**

---

## 15. CHANNEL ROUTING

### Exact `channelConnectionId`

- `sendDirectMessage` resolves `chat_sessions.channel_connection_id` → `channel_connections`.
- `chat-outbox.server.ts` writes `chat_message_outbox.channel_connection_id`.
- Provider dispatcher uses `context.channelConnectionId` for `providerAccountId`.

**Verdict: PASS for conversations that have `channel_connection_id` populated.**

### `LIMIT 1` routing

- `contact-identity.service.ts` uses `LIMIT 1` for identity/contact resolution by `phoneE164` or `id`.
- `conversation.service.ts` uses `LIMIT 1` by `contact_id` (no provider filter) — **risk if a contact is ever shared across providers**.
- `channel.service.ts` uses `LIMIT 1` for WhatsApp/Instagram config lookups; fallback picks first active channel for IG/Messenger when no exact channel found.

**Finding:** `conversation.service.ts:26-33` does not filter by `channel` or `provider`. If `contacts` ever becomes shared across providers, conversations could merge. This is a latent risk, not an active regression for WA/IG.

---

## 16. CONTACT IDENTITY ISOLATION

`contact-identity.service.ts` resolves by `(user_id, provider, external_id)` and writes `contacts` with `channel = provider`. WhatsApp, Instagram, WebChat each have isolated identity rows.

| Provider | `contacts.phone_e164` | `contacts.channel` | `contact_identities` key | Notes |
|----------|----------------------|-------------------|--------------------------|-------|
| WhatsApp | real E.164 | `whatsapp` | `(provider="whatsapp", external_id=wa_id)` | Normal |
| Instagram | `ig_<IGSID>` | `instagram` | `(provider="instagram", external_id=IGSID)` | Synthetic phone in `contacts` row only |
| WebChat | `NULL` | `webchat` | `(provider="webchat", external_id=visitorId)` | No real phone; `phoneE164` null |

**Verdict: PASS** — no cross-provider merge observed.

### Review item

Pre-chat WebChat phone is currently mapped into `contacts.whatsapp_number` (`contact-identity.service.ts:149`). It should arguably live in `custom_fields`/`metadata` because it is not a WhatsApp number.

---

## 17. BOT ROUTING

- `bot-trigger.service.ts` passes `provider` as `channel` to `processBotFlow`.
- `processBotFlow` has explicit branches for `whatsapp`, `instagram`, `messenger`, `webchat`.
- **Default parameter `channel = "whatsapp"` in `processBotFlow` and `executeInactivityStep` is a latent risk** — a caller that omits `channel` will silently misroute as WhatsApp.

**Verdict: PASS for current call sites; REVIEW for the default parameter.**

---

## 18. MESSAGE STATUS

- WhatsApp: `sent`, `delivered`, `read` via Meta webhook.
- Instagram: `sent` status returned by adapter; read receipts not yet full in active tests.
- WebChat: `sent` recorded by `WebChatOutboundAdapter`.

No shared enum forcing incorrect semantics was observed.

---

## 19. UNREAD

`listChatContacts` computes `unread_count` from `direct_messages` where `direction = 'incoming'` and `status IS NULL OR status != 'read'`.

For **WhatsApp/Instagram** this works because `direct_messages.contact_phone` matches `contacts.phone_e164`.
For **WebChat** this will be **empty** because `contacts.phone_e164` is `NULL` while `direct_messages.contact_phone` is `wc_<uuid>`.

**Finding: WebChat unread count in Inbox is currently broken by the join mismatch.**

---

## 20. LAST MESSAGE / PREVIEW

Same join issue as Unread: `last_dm.contact_phone = c.phone_e164` will not match WebChat contacts, so `last_message_body`, `last_message_time`, `last_message_type` will be `NULL`.

**Finding: WebChat last-message preview in Inbox is currently broken.**

---

## 21. MULTI-TENANT

All channel resolution queries include `tenant_id`. `getChannelConnection` explicitly rejects a connection not belonging to the tenant (`channel-connection.service.ts:43-46`).

**Verdict: PASS**

---

## 22. MULTIPLE CHANNELS SAME PROVIDER

Current `channel_connections` supports multiple connections per provider per tenant. `sendDirectMessage` resolves by `chat_sessions.channel_connection_id` when present.

**Risk:** If `chat_sessions.channel_connection_id` is `NULL`, `sendDirectMessage` falls back to `listChannelConnectionsForTenant` + `status === "active"` and picks the **first active** channel. This can misroute when multiple accounts exist for the same provider.

---

## 23. WEBCHAT MIGRATION IMPACT

### Migrations since baseline

| Migration | What it does | Impact on WA/IG |
|-----------|--------------|-----------------|
| `054_webchat.sql` | Extends `channel_connections.provider` enum to include `webchat`; makes `contacts.phone_e164` nullable; creates `webchat_widgets` and `webchat_sessions` | **NONE** — additive, no existing data changed |
| `055_webchat_avatar.sql` | Adds `avatar_url` to `webchat_widgets` | **NONE** — only new table |

No destructive changes, no existing provider rows rewritten, no constraints broken.

---

## 24. SHARED FILES MODIFIED SINCE WEBCHAT

Files that touch messaging core and were changed in the WebChat commit range:

| File | Reason | Classification |
|------|--------|----------------|
| `src/lib/messaging/processor.server.ts` | Adds `webchat` branch in `getContactPhoneForIdentity`, triggers bot for `webchat`, skips phone for `webchat` | **SAFE ADDITIVE** |
| `src/lib/messaging/services/contact-identity.service.ts` | Adds `webchat` branches; no WA/IG logic change | **SAFE ADDITIVE** |
| `src/lib/messaging/services/message.service.ts` | No provider-specific change observed; `provider` inserted as `channel` | **SAFE ADDITIVE** |
| `src/lib/messaging/services/bot-trigger.service.ts` | Passes `provider` to bot flow; no WA/IG branch change | **SAFE ADDITIVE** |
| `src/lib/messaging/services/bot-lifecycle.service.ts` | No WA/IG branch change; handles `channel = 'webchat'` | **SAFE ADDITIVE** |
| `src/lib/messaging/services/contact-display.service.ts` | No WA/IG branch change | **SAFE ADDITIVE** |
| `src/lib/messaging/services/instagram-profile-enrichment.service.ts` | Instagram-only; no WebChat touch | **SAFE** |
| `src/lib/messaging/adapters/instagram.adapter.ts` | Instagram-only; no WebChat touch | **SAFE** |
| `src/lib/messaging/outbound/provider-dispatcher.ts` | Registers `WebChatOutboundAdapter`; WA/IG registration unchanged | **SAFE ADDITIVE** |
| `src/lib/messaging/outbound/adapters/webchat-outbound-adapter.ts` | New file, only webchat | **SAFE ADDITIVE** |
| `src/lib/messaging/types.ts` | Adds `webchat` to `MessagingProvider` union | **SAFE ADDITIVE** |
| `src/lib/chat-outbox.server.ts` | No provider-specific change; `enqueueChatOutboxMessage` remains generic | **SAFE** |
| `src/lib/botflow-executor.server.ts` | Adds `webchat` branches; **default `channel = "whatsapp"` remains** | **REVIEW** (default parameter risk) |
| `src/routes/_app/chat.tsx` | Adds `messenger` filter UI; does not add `webchat` filter | **REVIEW** (WebChat missing) |
| `src/lib/chat.functions.ts` | `getConfiguredChannels` does not include `webchat`; `listChatContacts` joins break WebChat | **REVIEW** (WebChat Inbox broken) |
| `database/migrations/054_webchat.sql` | WebChat schema | **SAFE ADDITIVE** |
| `database/migrations/055_webchat_avatar.sql` | WebChat avatar column | **SAFE ADDITIVE** |

---

## 25. PROVIDER FILTER MATRIX

Expected vs observed (per tenant configuration):

| Tenant config | Expected filters | Observed filters (from `getConfiguredChannels`) |
|---------------|------------------|------------------------------------------------|
| WA | All, WA | All, WA |
| IG | All, IG | All, IG |
| WC | All, WC | **All only** (WebChat not returned) |
| MSG | All, MSG | All, MSG (if `facebook_pages` configured) |
| WA+IG | All, WA, IG | All, WA, IG |
| WA+WC | All, WA, WC | **All, WA** (WebChat missing) |
| IG+WC | All, IG, WC | **All, IG** (WebChat missing) |
| WA+IG+WC | All, WA, IG, WC | **All, WA, IG** (WebChat missing) |

**WebChat filter is not available in the Inbox UI.**

---

## 26. PROVIDER ROUTING MATRIX

Automated test evidence:

| Scenario | Expected | Result |
|----------|----------|--------|
| Conversation WA → send | WhatsApp adapter = 1, IG = 0, WC = 0 | **PASS** (golden path + omnichannel-next) |
| Conversation IG → send | Instagram adapter = 1, WA = 0, WC = 0 | **PASS** (golden path + omnichannel-next) |
| Conversation WC → send | WebChat adapter = 1, WA = 0, IG = 0 | **PASS** (`webchat-step2b`) |
| `selectedFilter = all`, `selectedConversation.provider = whatsapp` → send | WhatsApp | **PASS** (filter not used) |
| Unknown provider | Error / fail-closed | **PASS** (`provider-isolation` test) |

---

## 27. AUTOMATED TESTS

| Suite | Result |
|-------|--------|
| Inbox-specific tests | **Not found** — no `tests/jest/inbox` suite exists. |
| `tests/jest/omnichannel-golden-path.jest.test.ts` | **8/8 PASS** |
| `tests/jest/omnichannel-next` | **33 suites / 151 tests PASS** |
| `tests/jest/webchat` | **4 suites / 49 tests PASS** |
| `npm run type-check` | **PASS** |
| `npm run build` | **PASS** |
| `npm run guard:omnichannel` | **PASS** |

---

## 28. RUNTIME VALIDATION

| Provider | Manual runtime validation | Result |
|----------|---------------------------|--------|
| WhatsApp | Not executed — no controlled environment / no live Meta send | **NOT_EXECUTED** |
| Instagram | Not executed — no controlled environment / no live Meta send | **NOT_EXECUTED** |
| WebChat | Partial: `npm run preview` + curl confirms public widget/iframe/avatar render. Inbox conversation list not manually validated end-to-end. | **PARTIAL** |

---

## 29. REGRESSIONS FOUND

### CRITICAL

None affecting WhatsApp or Instagram.

### HIGH

1. **WebChat is not available as an Inbox provider filter.**
   - `getConfiguredChannels` does not include `webchat`.
   - `chat.tsx` `filterView` type and UI do not include a `webchat` pill.
   - This means the requested `Todos / WhatsApp / Instagram / Messenger / WebChat` filter bar is incomplete.

### MEDIUM

2. **WebChat conversations will not show `last_message`, `unread_count`, or `bot_active` in the Inbox.**
   - `listChatContacts` joins `direct_messages` and `bot_conversation_state` on `c.phone_e164`.
   - WebChat `contacts.phone_e164` is `NULL`, while `direct_messages.contact_phone` is `wc_<uuid>`.
   - The join fails for WebChat contacts.

3. **`conversation.service.ts` `ensureConversation` / `getConversationByContact` uses `contact_id` only (no `channel` filter).**
   - Latent cross-provider conversation merge risk if contact identity ever links providers.

### LOW

4. **`botflow-executor.server.ts` default `channel = "whatsapp"` for `processBotFlow` / `executeInactivityStep`.**
   - A caller that forgets to pass `channel` will silently route as WhatsApp.

5. **Pre-chat WebChat phone stored in `contacts.whatsapp_number`.**
   - Not a regression for WA/IG, but semantically incorrect.

---

## 30. CRITICAL RISKS

- **Inbox WebChat integration is not functional yet.** The widget and public API work, but the CRM Inbox cannot list, filter, or show unread/last-message for WebChat visitors.
- **`contacts.phone_e164 = NULL` design for WebChat conflicts with the existing Inbox SQL that assumes `phone_e164` is the join key for `direct_messages` and `bot_conversation_state`.**
- **No WhatsApp/Instagram regression detected.** Their inbound, outbound, identity, and queue isolation remain intact.

---

## 31. SAFE TO CONTINUE?

**NO for the Inbox WebChat filter feature as specified.**

The core WhatsApp and Instagram providers are stable, the build is green, and the automated non-regression suites pass. However, the requested `WebChat` Inbox filter is missing and the Inbox query model does not support WebChat contacts. Continuing with the current `listChatContacts` design for WebChat would result in broken conversation list, last-message preview, unread counts, and bot state.

---

## 32. WHATSAPP CERTIFICATION

**UNCHANGED_AND_STABLE**

- Outbound queue isolation: confirmed by golden path and omnichannel-next.
- Identity: `provider = "whatsapp"`, `external_id = wa_id`, no cross-provider merge.
- Inbox filter / display: unchanged.
- No WebChat branch interferes with WhatsApp code.

---

## 33. INSTAGRAM CERTIFICATION

**UNCHANGED_AND_STABLE**

- Outbound queue isolation: confirmed.
- Identity: `provider = "instagram"`, `external_id = IGSID`.
- Display name / avatar: unchanged.
- No WebChat branch interferes with Instagram code.

---

## 34. WEBCHAT CERTIFICATION

**ISOLATED at the adapter / identity layer, but NOT INTEGRATED into the Inbox.**

- Inbound/outbound provider isolation: **PASS**.
- Contact identity isolation: **PASS**.
- Bot integration: **PASS** (additive branches).
- Inbox conversation list support: **FAIL**.

---

## 35. INBOX CERTIFICATION

**REGRESSION_RISK for WebChat only.**

WhatsApp and Instagram remain provider-isolated. The Inbox filter logic does not control send. However, the Inbox is not ready to display WebChat conversations and the filter bar does not include WebChat.

---

## 36. FINAL STATUS

**PARTIAL**

- WhatsApp / Instagram: **PASS**.
- WebChat widget / API: **PASS**.
- WebChat Inbox integration: **BLOCKED** (missing filter + query join mismatch).

---

## 37. NEXT ACTION

**STOP. Do not continue with runtime changes until the following is resolved and re-audited:**

1. Add `webchat` to `getConfiguredChannels` source of truth (`channel_connections` or `webchat_widgets`) and to the Inbox `filterView` UI.
2. Fix `listChatContacts` SQL so WebChat joins use `contact_id` or `direct_messages.contact_phone = 'wc_' || contact_id` instead of `phone_e164`.
3. Evaluate whether `contacts.phone_e164` should remain `NULL` for WebChat or whether `direct_messages.contact_phone` should become the canonical join key.
4. Review `botflow-executor.server.ts` default `channel = "whatsapp"`.
5. Re-run the full gate suite (`type-check`, `build`, `guard`, `omnichannel-golden-path`, `omnichannel-next`, `webchat`) after changes.

---

*Report generated during read-only audit. No files were modified.*
