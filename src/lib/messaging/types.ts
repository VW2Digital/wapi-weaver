/**
 * Canonical messaging types for the omnichannel backend.
 *
 * These types are provider-agnostic. Adapters convert Meta payloads
 * (WhatsApp, Instagram, Messenger) into these canonical events.
 */

export type MessagingProvider = "whatsapp" | "instagram" | "messenger" | "webchat";

export type MessageDirection = "incoming" | "outgoing";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "reaction"
  | "interactive"
  | "template"
  | "postback"
  | "unknown";

export type EventType =
  | "message.received"
  | "message.sent"
  | "message.status"
  | "message.echo"
  | "template.status"
  | "template.category"
  | "account.update"
  | "call"
  | "history.sync"
  | "state.sync"
  | "unknown";

/**
 * Minimal contact identity as extracted from a provider payload.
 */
export interface CanonicalIdentity {
  /** Provider-scoped user id (e.g. WhatsApp phone, Instagram scoped id, PSID). */
  externalId: string;
  /** Human-readable name when available. */
  name?: string | null;
  /** Avatar / profile picture URL. */
  avatarUrl?: string | null;
  /** Optional normalized phone (digits only, when applicable). */
  phoneE164?: string | null;
  /** Extra provider-specific fields that should not be queried directly. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Canonical representation of a message attachment / media.
 */
export interface CanonicalAttachment {
  type: MessageType;
  /** Provider media id (e.g. WhatsApp media id). */
  providerMediaId?: string | null;
  /** Temporary remote URL, when provided by Meta. */
  remoteUrl?: string | null;
  /** MIME type. */
  mimeType?: string | null;
  /** File name for documents. */
  filename?: string | null;
  /** Caption text. */
  caption?: string | null;
  /** Size in bytes when known. */
  size?: number | null;
  /** SHA-256 hash when provided. */
  sha256?: string | null;
  /** Provider-specific payload kept for reference. */
  raw?: unknown;
}

/**
 * Canonical message payload extracted from any provider.
 */
export interface CanonicalMessage {
  /** Provider message id (wa_message_id, mid, etc.). */
  providerMessageId: string;
  /** Direction relative to the tenant. */
  direction: MessageDirection;
  type: MessageType;
  body: string;
  /** WhatsApp reaction target or reply-to message id. */
  replyToMessageId?: string | null;
  /** Button / quick-reply / list payload. */
  buttonPayload?: string | null;
  /** Attachments (media, stickers, etc.). */
  attachments?: CanonicalAttachment[];
  /** Unix timestamp (seconds) from the provider, if available. */
  providerTimestamp?: number | null;
  /** Original sender identity. */
  sender: CanonicalIdentity;
  /** Recipient identity (usually the tenant's channel). */
  recipient: CanonicalIdentity;
  /** For groups: external group id and participant info. */
  externalGroupId?: string | null;
  senderWaId?: string | null;
  senderName?: string | null;
  /** Provider-specific payload kept for reference. */
  raw?: unknown;
}

/**
 * Canonical status update payload.
 */
export interface CanonicalStatusUpdate {
  providerMessageId: string;
  status: MessageStatus;
  /** Unix timestamp (seconds) from the provider. */
  providerTimestamp?: number | null;
  /** Conversation id from WhatsApp status webhooks. */
  conversationId?: string | null;
  /** Conversation origin category from WhatsApp. */
  conversationOrigin?: string | null;
  /** Pricing metadata from WhatsApp. */
  pricing?: {
    billable?: boolean | null;
    category?: string | null;
    model?: string | null;
  };
  /** Errors from provider. */
  errors?: unknown;
  /** Provider-specific payload kept for reference. */
  raw?: unknown;
}

/**
 * Canonical event produced by provider adapters.
 *
 * This is the only contract the downstream processor needs to understand.
 */
export interface CanonicalEvent {
  /** Internal id generated when persisting the event. */
  id?: string;
  /** Provider that emitted the event. */
  provider: MessagingProvider;
  /** Tenant id resolved from the channel configuration. */
  tenantId: string;
  /** Optional user id that owns the connected channel (legacy, when different from tenant). */
  userId?: string | null;
  /** Canonical event type. */
  eventType: EventType;
  /** Provider-specific external event id for idempotency. */
  externalEventId: string;
  /** Channel resource id (phone_number_id, page_id, instagram_account_id, etc.). */
  channelResourceId: string;
  /** Resolved channel_connection id. */
  channelConnectionId?: string | null;
  /** Resolved meta_app_connection id. */
  metaAppConnectionId?: string | null;
  /** Timestamp the event was received by our server. */
  receivedAt: string;
  /** Timestamp the event occurred at the provider (if known). */
  providerTimestamp?: number | null;
  /** Normalized payload. */
  payload: CanonicalMessage | CanonicalStatusUpdate | unknown;
  /** Raw provider payload. */
  rawPayload: unknown;
  /** Processing status. */
  status: "pending" | "processing" | "completed" | "failed";
  /** Retry counter. */
  attemptCount: number;
  /** Last error message when status is failed. */
  lastError?: string | null;
}

/**
 * Result returned by an adapter when normalizing a raw payload.
 */
export interface NormalizationResult {
  events: CanonicalEvent[];
  /** Diagnostics for logging only. Never expose secrets. */
  diagnostics?: {
    entryCount?: number;
    ignoredCount?: number;
    reasons?: string[];
  };
}

/**
 * Adapter interface every provider must implement.
 */
export interface MessagingAdapter {
  readonly provider: MessagingProvider;
  normalize(rawPayload: unknown): Promise<NormalizationResult> | NormalizationResult;
  /** Returns the channel resource id(s) present in the payload. */
  extractChannelResourceIds(rawPayload: unknown): string[];
  /** Optional: build a deterministic idempotency key when no explicit event id exists. */
  buildExternalEventId?(eventType: EventType, payload: unknown): string;
}
