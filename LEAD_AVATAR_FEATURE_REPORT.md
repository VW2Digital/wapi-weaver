# LEAD AVATAR FEATURE REPORT

## SCHEMA AUDIT

- `contacts` already carries `avatar_url` inside `custom_fields`.
- `contact_identities` already has the canonical columns:
  - `external_id` (IGSID)
  - `provider`
  - `username`
  - `avatar_url`
  - `metadata` (JSON)
  - `tenant_id`, `user_id`, `contact_id`
- No destructive or additive migration was required because the schema already supports provider-identity avatars.

## MIGRATION

- Created: **NO** (not required)
- Destructive: **NO**

## FILES CREATED

- `src/lib/messaging/services/instagram-profile-enrichment.service.ts`
- `tests/jest/lead-avatar.jest.test.ts`

## FILES MODIFIED

- `src/lib/messaging/services/contact-identity.service.ts`
  - Adds `avatar_source` and `avatar_fetched_at` to `contact_identities.metadata` when an Instagram `avatarUrl` is present.
- `src/routes/_app/chat.tsx`
  - `getContactAvatarUrl` now allows Instagram/Messenger CDNs (`fbcdn.net`, `fbsbx.com`) while keeping WhatsApp URLs blocked so WhatsApp leads fall back to initials.

## PROTECTED MESSAGING RUNTIME MODIFIED

- **NO**
- The following protected files were **not** changed:
  - `src/lib/instagram.functions.ts`
  - `src/lib/messaging/webhook-handlers/instagram.handler.ts`
  - `src/lib/chat.functions.ts`
  - `src/lib/messaging/outbound/adapters/instagram.api.ts`
  - `src/lib/messaging/outbound/`

## INSTAGRAM API VARIANT AUDIT

- Current variant: **FACEBOOK LOGIN / PAGE-LINKED**
- Profile endpoint proven: **YES**
  - Uses the official Instagram User Profile API:
    `GET https://graph.facebook.com/v{version}/{igsid}?fields=name,username,profile_pic`
    with a Page Access Token in the `Authorization` header.
- Outbound modified: **NO**

## INSTAGRAM PROFILE LOOKUP

- **PASS**
- Identity used: **IGSID** (`contact_identities.external_id`)
- Cross-tenant: **PASS** (`tenant_id` filter)
- Cross-channel: **PASS** (`provider = 'instagram'`)

## AVATAR CACHE

- **PASS**
- Avatars are persisted in `contact_identities.avatar_url` and projected to `contacts.custom_fields.avatar_url`.
- Cache source and timestamp are stored in `contact_identities.metadata`:
  - `avatar_source: 'instagram_user_profile_api'`
  - `avatar_fetched_at: ISO 8601`
- Refresh policy: avatar is refreshed on every inbound Instagram message (current webhook behavior). Expired/broken images fall back to initials via `onError`.

## WHATSAPP

- Unofficial API used: **NO**
- Lead avatar fetched from WhatsApp: **NO**
- Fallback initials: **PASS**

## FRONTEND

- `avatarUrl` supported: **PASS**
- Image shown: **PASS**
- Broken image fallback: **PASS** (`onError` hides image and shows initials)
- Initials fallback: **PASS**

## INBOUND MESSAGE FLOW

- Blocked by avatar lookup: **NO**
- Failures are caught and swallowed; message processing continues.

## SECURITY

- Token sent to frontend: **0**
- Token in logs: **0**
- Credential leak: **0**

## GOLDEN PATH

- **PASS** (8/8)

## NEXT TESTS

- **PASS** (151/151)

## BUILD

- **PASS**

## TYPECHECK

- **PASS**

## FEATURE STATUS

- **PASS**

## FINAL RESULT

- Instagram avatars: **WORKING**
- WhatsApp avatars: **INITIALS FALLBACK**

## NEXT ACTION

STOP
