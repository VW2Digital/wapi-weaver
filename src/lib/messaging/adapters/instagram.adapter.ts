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
  logAdapterError,
  resolveMessageType,
} from "./base.adapter";

export type InstagramRawPayload = {
  object?: string;
  entry?: InstagramEntry[];
};

type InstagramEntry = {
  id?: string;
  time?: number;
  messaging?: InstagramMessagingEvent[];
};

type InstagramRead = {
  mid?: string;
};

type InstagramMessagingEvent = {
  sender?: { id?: string; name?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: InstagramMessage;
  reaction?: InstagramReaction;
  message_edit?: InstagramMessage;
  read?: InstagramRead;
  postback?: { title?: string; payload?: string; mid?: string };
};

type InstagramMessage = {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  quick_reply?: { payload?: string };
  reply_to?: { story?: unknown };
  attachments?: InstagramAttachment[];
  sticker?: { url?: string; id?: string };
};

type InstagramReaction = {
  mid?: string;
  reaction?: string;
  emoji?: string;
  action?: string;
};

type InstagramAttachment = {
  type?: string;
  payload?: {
    url?: string;
    attachment_id?: string;
    sticker_id?: string;
  };
};

function resolveInstagramMessageType(
  message: InstagramMessage,
): { type: MessageType; body: string; attachments: CanonicalAttachment[] } {
  let type: MessageType = "text";
  let body = message.text || "";
  const attachments: CanonicalAttachment[] = [];

  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    type = resolveMessageType(attachment.type);
    const remoteUrl = attachment.payload?.url || "";
    const meta = {
      url: remoteUrl,
      id: attachment.payload?.sticker_id || attachment.payload?.attachment_id,
    };

    if (type === "document" && (attachment.type === "fallback" || attachment.type === "ig_reel")) {
      // keep document/unknown
    }
    if (
      attachment.type === "animated_image_share" ||
      attachment.type === "share" ||
      attachment.type === "ig_reel"
    ) {
      if (remoteUrl) {
        type = remoteUrl ? "video" : "unknown";
      }
    }
    attachments.push(buildAttachment(type, meta));
  } else if (message.sticker) {
    type = "sticker";
    attachments.push(
      buildAttachment("sticker", { url: message.sticker.url, id: message.sticker.id }),
    );
  }

  if (message.reply_to?.story) {
    type = "text";
    body = message.text ? `${message.text}\n\n(Respondendo ao Story)` : "(Respondeu ao Story)";
  }

  if (message.quick_reply) {
    body = message.quick_reply.payload || message.text || "";
  }

  return { type, body, attachments };
}

export class InstagramAdapter extends BaseMessagingAdapter {
  readonly provider = "instagram" as const;

  extractChannelResourceIds(rawPayload: unknown): string[] {
    const payload = rawPayload as InstagramRawPayload;
    const ids = new Set<string>();
    for (const entry of payload?.entry ?? []) {
      if (entry.id) ids.add(String(entry.id));
    }
    return Array.from(ids);
  }

  normalize(rawPayload: unknown): NormalizationResult {
    const payload = rawPayload as InstagramRawPayload;
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

        const phonePlaceholder = `ig_${senderId}`;
        const contactName = item.sender?.name || `Instagram (${senderId})`;

        if (item.message) {
          const message = item.message;
          const mid = message.mid;
          if (!mid) {
            reasons.push("missing message mid");
            continue;
          }
          const { type, body, attachments } = resolveInstagramMessageType(message);

          const canonicalMessage: CanonicalMessage = {
            providerMessageId: mid,
            direction: message.is_echo ? "outgoing" : "incoming",
            type,
            body,
            attachments,
            providerTimestamp: item.timestamp ?? null,
            sender: buildIdentity(senderId, { name: contactName, metadata: { recipientId } }),
            recipient: buildIdentity(recipientId),
            raw: item,
          };

          const eventType = message.is_echo ? "message.echo" : "message.received";
          events.push(
            buildEventBase(
              this.provider,
              "",
              eventType,
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
                sender: buildIdentity(senderId, { name: contactName, metadata: { recipientId } }),
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
                sender: buildIdentity(senderId, { name: contactName, metadata: { recipientId } }),
                recipient: buildIdentity(recipientId),
                raw: item,
              } as CanonicalMessage,
              payload,
              { providerTimestamp: item.timestamp ?? null },
            ),
          );
        }

        if (item.read) {
          if (item.read.mid) {
            const statusUpdate = {
              providerMessageId: item.read.mid,
              status: "read" as const,
              providerTimestamp: item.timestamp ?? null,
            };
            events.push(
              buildEventBase(
                this.provider,
                "",
                "message.status",
                `seen:${item.read.mid}:${item.timestamp ?? Date.now()}`,
                pageId,
                statusUpdate,
                payload,
                { providerTimestamp: item.timestamp ?? null },
              ),
            );
          } else {
            reasons.push("missing read mid");
          }
        }
      }
    }

    return { events, diagnostics: { entryCount: payload?.entry?.length, ignoredCount: reasons.length, reasons } }
  }
}

export const instagramAdapter = new InstagramAdapter();
