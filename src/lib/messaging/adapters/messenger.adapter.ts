"use server";

import type {
  CanonicalAttachment,
  CanonicalEvent,
  CanonicalMessage,
  MessageType,
  NormalizationResult,
} from "../types";
import {
  BaseMessagingAdapter,
  buildAttachment,
  buildEventBase,
  buildIdentity,
  resolveMessageType,
} from "./base.adapter";

export type MessengerRawPayload = {
  object?: string;
  entry?: MessengerEntry[];
};

type MessengerEntry = {
  id?: string;
  time?: number;
  messaging?: MessengerMessagingEvent[];
};

type MessengerMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: MessengerMessage;
  postback?: { title?: string; payload?: string; mid?: string };
  reaction?: MessengerReaction;
};

type MessengerMessage = {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  attachments?: MessengerAttachment[];
  quick_reply?: { payload?: string };
};

type MessengerReaction = {
  mid?: string;
  reaction?: string;
  emoji?: string;
  action?: string;
};

type MessengerAttachment = {
  type?: string;
  payload?: {
    url?: string;
    attachment_id?: string;
    sticker_id?: string;
  };
};

function resolveMessengerMessageType(
  message: MessengerMessage,
): { type: MessageType; body: string; attachments: CanonicalAttachment[] } {
  let type: MessageType = "text";
  let body = message.text || "";
  const attachments: CanonicalAttachment[] = [];

  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    type = resolveMessageType(attachment.type);
    const meta = {
      url: attachment.payload?.url,
      id: attachment.payload?.attachment_id || attachment.payload?.sticker_id,
    };
    attachments.push(buildAttachment(type, meta));
  }

  if (message.quick_reply) {
    body = message.quick_reply.payload || message.text || "";
  }

  return { type, body, attachments };
}

export class MessengerAdapter extends BaseMessagingAdapter {
  readonly provider = "messenger" as const;

  extractChannelResourceIds(rawPayload: unknown): string[] {
    const payload = rawPayload as MessengerRawPayload;
    const ids = new Set<string>();
    for (const entry of payload?.entry ?? []) {
      if (entry.id) ids.add(String(entry.id));
    }
    return Array.from(ids);
  }

  normalize(rawPayload: unknown): NormalizationResult {
    const payload = rawPayload as MessengerRawPayload;
    const events: CanonicalEvent[] = [];
    const reasons: string[] = [];

    for (const entry of payload?.entry ?? []) {
      const pageId = entry.id ? String(entry.id) : "";
      for (const item of entry.messaging ?? []) {
        const senderId = item.sender?.id;
        const recipientId = item.recipient?.id;
        if (!senderId || !recipientId) {
          reasons.push("missing sender or recipient");
          continue;
        }

        const contactName = `Facebook User (${senderId})`;

        if (item.message) {
          const message = item.message;
          const mid = message.mid;
          if (!mid) {
            reasons.push("missing message mid");
            continue;
          }
          const { type, body, attachments } = resolveMessengerMessageType(message);
          const canonicalMessage: CanonicalMessage = {
            providerMessageId: mid,
            direction: message.is_echo ? "outgoing" : "incoming",
            type,
            body,
            attachments,
            providerTimestamp: item.timestamp ?? null,
            sender: buildIdentity(senderId, { name: contactName }),
            recipient: buildIdentity(recipientId),
            raw: item,
          };

          events.push(
            buildEventBase(
              this.provider,
              "",
              message.is_echo ? "message.echo" : "message.received",
              mid,
              pageId,
              canonicalMessage,
              payload,
              { providerTimestamp: item.timestamp ?? null },
            ),
          );
        }

        if (item.postback) {
          const postback = item.postback;
          const body = postback.payload || postback.title || "";
          const externalEventId = postback.mid || `postback:${recipientId}:${Date.now()}`;
          events.push(
            buildEventBase(
              this.provider,
              "",
              "message.received",
              externalEventId,
              pageId,
              {
                providerMessageId: externalEventId,
                direction: "incoming",
                type: "postback",
                body,
                sender: buildIdentity(senderId, { name: contactName }),
                recipient: buildIdentity(recipientId),
                raw: item,
              } as CanonicalMessage,
              payload,
              { providerTimestamp: item.timestamp ?? null },
            ),
          );
        }

        if (item.reaction) {
          const reaction = item.reaction;
          const externalEventId = reaction.mid || `react:${senderId}:${Date.now()}`;
          events.push(
            buildEventBase(
              this.provider,
              "",
              "message.received",
              externalEventId,
              pageId,
              {
                providerMessageId: externalEventId,
                direction: "incoming",
                type: "reaction",
                body: reaction.emoji || "❤️",
                sender: buildIdentity(senderId, { name: contactName }),
                recipient: buildIdentity(recipientId),
                raw: item,
              } as CanonicalMessage,
              payload,
              { providerTimestamp: item.timestamp ?? null },
            ),
          );
        }
      }
    }

    return { events, diagnostics: { entryCount: payload?.entry?.length, ignoredCount: reasons.length, reasons } };
  }
}

export const messengerAdapter = new MessengerAdapter();
