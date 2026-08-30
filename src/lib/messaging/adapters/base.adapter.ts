"use server";

import { randomUUID } from "crypto";
import type {
  CanonicalAttachment,
  CanonicalEvent,
  CanonicalIdentity,
  EventType,
  MessageDirection,
  MessageStatus,
  MessageType,
  MessagingProvider,
  NormalizationResult,
} from "../types";

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export function normalizePhoneDigits(value: string | null | undefined): string {
  return value ? value.replace(/\D+/g, "") : "";
}

export function toIsoFromUnixTimestamp(value: string | number | undefined | null): string | null {
  if (!value) return null;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp * 1000).toISOString();
}

export function normalizeProviderMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  // Remove any trailing suffixes Meta may add for retries.
  return String(value).split("_").pop() ?? null;
}

export function buildEventBase(
  provider: MessagingProvider,
  tenantId: string,
  eventType: EventType,
  externalEventId: string,
  channelResourceId: string,
  payload: unknown,
  rawPayload: unknown,
  options: {
    userId?: string | null;
    providerTimestamp?: number | null;
    channelConnectionId?: string | null;
    metaAppConnectionId?: string | null;
  } = {},
): CanonicalEvent {
  return {
    id: randomUUID(),
    provider,
    tenantId,
    userId: options.userId ?? tenantId,
    eventType,
    externalEventId,
    channelResourceId,
    channelConnectionId: options.channelConnectionId ?? null,
    metaAppConnectionId: options.metaAppConnectionId ?? null,
    receivedAt: new Date().toISOString(),
    providerTimestamp: options.providerTimestamp ?? null,
    payload,
    rawPayload,
    status: "pending",
    attemptCount: 0,
    lastError: null,
  };
}

export function resolveMessageType(rawType: string | undefined): MessageType {
  const allowed = new Set<MessageType>([
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "location",
    "contacts",
    "reaction",
    "interactive",
    "template",
    "postback",
    "unknown",
  ]);
  const normalized = (rawType ?? "text").toLowerCase();
  return allowed.has(normalized as MessageType) ? (normalized as MessageType) : "unknown";
}

export function resolveMessageStatus(rawStatus: string | undefined): MessageStatus | null {
  const allowed = new Set<MessageStatus>(["queued", "sent", "delivered", "read", "failed"]);
  const normalized = (rawStatus ?? "").toLowerCase();
  return allowed.has(normalized as MessageStatus) ? (normalized as MessageStatus) : null;
}

export function resolveMessageDirection(raw: string | undefined): MessageDirection {
  return raw === "outgoing" ? "outgoing" : "incoming";
}

export function buildAttachment(
  type: MessageType,
  meta: Record<string, unknown> | null | undefined,
): CanonicalAttachment {
  return {
    type,
    providerMediaId: (meta?.id as string) || null,
    remoteUrl: (meta?.url as string) || null,
    mimeType: (meta?.mime_type as string) || null,
    filename: (meta?.filename as string) || null,
    caption: (meta?.caption as string) || null,
    sha256: (meta?.sha256 as string) || null,
    raw: meta ?? null,
  };
}

export function buildIdentity(
  externalId: string,
  options: {
    name?: string | null;
    avatarUrl?: string | null;
    phoneE164?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): CanonicalIdentity {
  return {
    externalId,
    name: options.name ?? null,
    avatarUrl: options.avatarUrl ?? null,
    phoneE164: options.phoneE164 ?? null,
    metadata: options.metadata ?? null,
  };
}

export function logAdapterWarning(provider: MessagingProvider, message: string, data?: unknown) {
  console.warn(`[messaging:${provider}] ${message}`, data ? JSON.stringify(data) : "");
}

export function logAdapterError(provider: MessagingProvider, message: string, data?: unknown) {
  console.error(`[messaging:${provider}] ${message}`, data ? JSON.stringify(data) : "");
}

export abstract class BaseMessagingAdapter {
  abstract readonly provider: MessagingProvider;
  abstract normalize(rawPayload: unknown): Promise<NormalizationResult> | NormalizationResult;
  abstract extractChannelResourceIds(rawPayload: unknown): string[];

  protected safeParseJson(value: unknown): JsonObject | null {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        return this.safeParseJson(parsed);
      } catch {
        return null;
      }
    }
    if (typeof value !== "object" || Array.isArray(value)) return null;
    return value as JsonObject;
  }

  protected getString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  protected getNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
  }

  protected getObject(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
  }
}
