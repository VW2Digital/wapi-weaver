# WebChat Architecture

## Overview

The WebChat channel is a first-class omnichannel citizen in the Bliv platform.
It allows visitors on a tenant website to start a real-time conversation that is
handled by the same Inbox, bot engine and human agents as WhatsApp and
Instagram. This document describes the final architecture of the feature after
Step 3.

## Components

```
Website
  |
  v
<script src="/api/public/webchat/{publicId}/widget/js" async></script>
  |
  v
widget.js
  |
  v
<iframe src="/api/public/webchat/{publicId}/iframe?parentOrigin=...">
  |
  v
WebChat Public API
  |
  v
WebChat Session / Inbound / History / Status services
  |
  v
Messaging Core (contacts, conversations, messages, bot engine, outbox)
  |
  +--> Inbox (React app, /_app/chat)
  +--> BotTriggerService
  +--> Human CRM replies
  |
  v
WebChatOutboundAdapter
  |
  v
Browser (polling / history)
```

## Public endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/public/webchat/{publicId}/widget/js` | none | Embeddable loader script. |
| GET | `/api/public/webchat/{publicId}/config` | none | Public widget settings. |
| GET | `/api/public/webchat/{publicId}/iframe` | none | HTML/JS iframe content. |
| POST | `/api/public/webchat/{publicId}/session` | origin check | Create visitor session. |
| GET | `/api/public/webchat/{publicId}/session` | session token | Resume visitor session. |
| POST | `/api/public/webchat/{publicId}/messages` | session token | Send visitor message. |
| GET | `/api/public/webchat/{publicId}/history` | session token | Poll conversation history. |
| POST | `/api/public/webchat/{publicId}/status` | session token | Acknowledge delivered/read. |

## Message lifecycle

A WebChat message has the same status enum as other channels:
`queued`, `sent`, `delivered`, `read`, `failed`.

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `queued` | Message accepted into the outbox, waiting for adapter result. | `chat-outbox.server.ts` |
| `sent` | Adapter persisted the message and accepted it for delivery. | `WebChatOutboundAdapter` / outbox completion |
| `delivered` | The visitor's browser actually received the message via history/poll. | Widget `POST /status` |
| `read` | The message became visible to the visitor. | Widget `POST /status` |
| `failed` | Could not be delivered. | Adapter or outbox failure |

## Status acknowledgement flow

```
CRM / Bot
  |
  v
Messaging Core
  |
  v
WebChatOutboundAdapter returns providerMessageId
  |
  v
direct_messages.status = 'sent'
  |
  v
Widget polls GET /history
  |
  v
Widget sees new outgoing message
  |
  +--> POST /status { updates: [{messageId, status: 'delivered'}] }
  +--> Message enters viewport while widget is open and visible
       +--> POST /status { updates: [{messageId, status: 'read'}] }
  |
  v
direct_messages.status = 'delivered' | 'read'
```

The status update is monotonic (`read` never regresses to `delivered`, etc.)
and is atomic in the database using `FIELD(...)` ordering.

## Key design decisions

1. **No schema migration was needed**: `direct_messages` already supports
   `queued`, `sent`, `delivered`, `read`, `failed` plus `delivered_at` and
   `read_at`.
2. **WebChat status is provider-local**: WhatsApp keeps Meta receipts,
   Instagram keeps its own semantics, WebChat keeps browser ACKs.
3. **Acknowledgements are batched**: The widget accumulates IDs and sends a
   single `POST /status` request to reduce network chatter.
4. **Visibility is real**: `read` is only emitted when the iframe is actually
   open, the document/tab is visible, and the message bubble intersects the
   viewport (IntersectionObserver).
5. **Session drives ownership**: The conversation is derived from the session,
   never from the request body, preventing cross-conversation, cross-widget or
   cross-tenant status ACKs.

## Security

- Session tokens are stored as SHA-256 hashes only.
- Origin is validated against the widget `allowed_origins` array.
- The `iframe` endpoint returns a `Content-Security-Policy` whose
  `frame-ancestors` directive is derived from `allowed_origins`.
- The loader script, config and iframe HTML never expose tenant secrets,
  channel credentials or raw session tokens.
- See `WEBCHAT_SECURITY.md` for the complete security model.
