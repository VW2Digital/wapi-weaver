# WebChat Security

## Threat model

The WebChat widget runs on arbitrary tenant websites inside a public iframe.
This makes it exposed to:

- Malicious parent pages embedding the tenant's widget.
- Session token exfiltration if stored or transmitted insecurely.
- Cross-tenant or cross-widget data leakage.
- XSS through widget configuration fields.
- Abuse of public endpoints.

This document describes the controls in place.

## Session tokens

- Tokens are generated with `randomBytes(32).toString("base64url")`.
- Only `SHA-256(token)` is stored in `webchat_sessions.token_hash`.
- The raw token is transmitted only once in the `POST /session` response.
- Tokens are verified by hash on every authenticated request.
- Sessions have `expires_at` (30 days) and `status` (`active`, `closed`, `expired`).
- Expired, closed or revoked sessions are rejected (`getWebchatSessionByToken`).
- No logs emit raw tokens.

## Origin validation

- `checkOrigin` normalizes origins to `protocol + host` (e.g.
  `https://example.com:8080`).
- It uses exact equality, not `startsWith`, `includes` or substring matching.
- `https://empresa.com.br.evil.com` does **not** match `https://empresa.com.br`.
- If `allowed_origins` is empty, the project allows any origin by default to
  preserve backwards compatibility; tenants should set allowed origins for
  production use.

## Content Security Policy

- The `iframe` endpoint sets `Content-Security-Policy: frame-ancestors 'self' <allowed>;`.
- The allowed values are the normalized entries of `widget.allowed_origins`.
- If no origins are configured it falls back to `frame-ancestors *;` to avoid
  breaking existing widgets that have not set the allow-list yet.
- The invalid `X-Frame-Options: ALLOW-FROM *` header has been removed.

## CORS

- Authenticated endpoints (`/session`, `/messages`, `/history`, `/status`)
  include `Access-Control-Allow-Origin` equal to the request `Origin`.
- This is a reflection of the browser-provided origin, not a security decision.
  The real access control happens via `checkOrigin` and session validation.

## iframe isolation

- The widget runs inside an iframe loaded from the application origin.
- `postMessage` from the iframe to the parent uses the explicit parent origin
  captured via `?parentOrigin=...`, not `*`.
- The parent page validates that incoming `bliv-webchat-close` messages come from
  the widget iframe (`e.source === iframe.contentWindow`).

## Configuration leakage

- `GET /config` returns only public UI fields: title, welcome message,
  placeholder, accent color, position, pre-chat flag, avatar URL.
- It does not return `tenant_id`, `channel_connection_id`, credentials or
  tokens.

## Widget script

- `widget.js` contains only `publicId`, `configUrl` and `iframeUrl`.
- No secrets are embedded.

## XSS hardening

- The iframe HTML is generated as a plain string template. Widget fields used in
  text nodes or HTML attributes are passed through `escapeHtml`.
- `accentColor` is validated with a strict hex regex before being interpolated
  into CSS and JavaScript contexts. Only `#rrggbb` or `#rgb` forms are allowed;
  invalid values fall back to the default accent color.
- `avatarUrl` is validated to be `http:` or `https:` only; `javascript:`, `data:`
  and other schemes are rejected.
- The Inbox message rendering uses escaped strings and does not interpret
  arbitrary HTML.

## Rate limiting

- Session creation: `webchat:rate:session:{publicId}:{ip}`, 10/60s.
- Messages: `webchat:rate:msg:session:{sessionId}` (60/60s) and
  `webchat:rate:msg:ip:{publicId}:{ip}` (60/60s). The IP bucket is scoped by
  widget so one tenant's traffic cannot starve another.
- Status ACKs: `webchat:rate:status:{publicId}:{sessionId}`, 120/60s.
- All rate limits return `HTTP 429` without side effects.
- Redis failures are logged and fail open to avoid breaking the widget during
  infrastructure outages.

## Multi-tenancy and multi-widget isolation

- Every authenticated query is scoped by `tenant_id`, `channel_connection_id`
  and `conversation_id` derived from the session.
- A session cannot read messages, send messages or ACK statuses from another
  widget or tenant, even with a valid-looking `messageId`.
- Unknown `messageId` values are rejected without creating rows.
- Status updates can only touch `direction = 'outgoing'` messages (CRM/bot
  replies to the visitor); visitors cannot ACK their own inbound messages.

## Status acknowledgement security

The `POST /status` endpoint:

1. Validates `publicId` and session token.
2. Derives `conversation_id` from the session, never from the client.
3. Verifies `message.tenant_id = session.tenant_id`.
4. Verifies `message.conversation_id = session.conversation_id`.
5. Verifies `message.channel_connection_id = session.channel_connection_id`.
6. Verifies `message.channel = 'webchat'` and `message.direction = 'outgoing'`.
7. Applies the update atomically with monotonic status ranking.

This prevents cross-tenant, cross-widget, cross-conversation and
incoming-message ACK attacks.

## Secrets checklist

| Secret | In DB | In logs | In widget.js | In iframe HTML | In config |
|--------|-------|---------|--------------|----------------|-----------|
| Session token (raw) | hash only | no | no | no | no |
| Meta credentials | n/a | n/a | no | no | no |
| Channel connection id | yes | no | no | no | no |
| `publicId` | yes | no | yes (intended) | yes (URL) | yes |
