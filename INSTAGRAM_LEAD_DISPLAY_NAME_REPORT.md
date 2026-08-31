# INSTAGRAM LEAD DISPLAY NAME REPORT

## ROOT CAUSE

- `src/lib/messaging/adapters/instagram.adapter.ts` normalized the sender with the fallback `Instagram (<igsid>)` because the Instagram webhook payload does not include the lead's name or username.
- The protected webhook handler (`src/lib/messaging/webhook-handlers/instagram.handler.ts`) already calls the Instagram User Profile API, but it only stores `data.name || data.username` into `message.sender.name`.
- `src/routes/_app/chat.tsx` rendered `c.name` directly from `contacts.name`, so when the API data was absent or a placeholder, the conversation list showed `Instagram (1086930...)`.

## DISPLAY NAME SOURCE BEFORE

```text
c.name from contacts table
└── fallback: Instagram (1086930...)
```

## DISPLAY NAME SOURCE AFTER

```text
contact.custom_fields.instagram_profile_name
↓
contact.custom_fields.instagram_username
↓
contact.name (if not a placeholder)
↓
Instagram (igsid) fallback
```

## INSTAGRAM PROFILE

- name persisted: **YES**
- username persisted: **YES**
- avatar preserved: **YES**

## DISPLAY PRIORITY

1. Instagram `name` (`custom_fields.instagram_profile_name`)
2. `@username` (`custom_fields.instagram_username`)
3. `contact.name` if it is not a placeholder
4. `Instagram (igsid)`

## BUG FIX

- Instagram with name: **PASS**
- Instagram with username only: **PASS**
- Instagram without profile data: **PASS**

## EXAMPLE

Before:

```text
Instagram (1086930...)
```

After:

```text
João Silva
```

or, if name not available:

```text
@joaosilva
```

## WHATSAPP NAME BEHAVIOR

**UNCHANGED REQUIRED**

## INSTAGRAM OUTBOUND MODIFIED

**NO REQUIRED**

## WHATSAPP OUTBOUND MODIFIED

**NO REQUIRED**

## PROFILE LOOKUP BLOCKS MESSAGES

**NO REQUIRED**

- `contact-identity.service.ts` calls `InstagramProfileEnrichmentService.fetchProfile` only when the inbound identity is missing or has a placeholder name.
- All network and credential errors are caught; message processing continues with the fallback name.

## TESTS

- `tests/jest/instagram-display-name.jest.test.ts`: **7/7 PASS**
- `tests/jest/lead-avatar.jest.test.ts`: **12/12 PASS**
- `tests/jest/omnichannel-golden-path.jest.test.ts`: **8/8 PASS**
- `tests/jest/omnichannel-next`: **151/151 PASS**

## GOLDEN PATH

**PASS**

## NEXT TESTS

**PASS**

## TYPECHECK

**PASS**

## BUILD

**PASS**

## FREEZE

**PASS**

## FEATURE STATUS

**PASS**

## NEXT ACTION

STOP
