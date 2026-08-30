"use server";

export interface InstagramSendPayload {
  recipient: { id: string };
  message_type: "RESPONSE" | "MESSAGE_TAG";
  tag?: "HUMAN_AGENT";
  context?: { message_id: string };
  message?: Record<string, unknown>;
  sender_action?: string;
  payload?: Record<string, unknown>;
}

export interface InstagramOutboundPayloadData {
  type: string;
  text?: { body: string; preview_url?: boolean } | null;
  reaction?: { message_id: string; emoji: string } | null;
  image?: { id?: string | null; link?: string | null } | null;
  audio?: { id?: string | null; link?: string | null } | null;
  video?: { id?: string | null; link?: string | null } | null;
  document?: { id?: string | null; link?: string | null; filename?: string | null } | null;
  quick_replies?: Array<{ content_type: "text"; title: string; payload: string }> | null;
}

export function buildInstagramOutboundPayload(
  recipientId: string,
  data: InstagramOutboundPayloadData,
  options: { replyToMessageId?: string | null; useHumanAgentTag?: boolean } = {},
): InstagramSendPayload {
  const payload: InstagramSendPayload = {
    recipient: { id: recipientId },
    message_type: options.useHumanAgentTag ? "MESSAGE_TAG" : "RESPONSE",
  };

  if (options.useHumanAgentTag) {
    payload.tag = "HUMAN_AGENT";
  }

  if (options.replyToMessageId) {
    payload.context = { message_id: options.replyToMessageId };
  }

  if (data.type === "text") {
    payload.message = { text: data.text?.body || "" };
    if (data.quick_replies && data.quick_replies.length > 0) {
      (payload.message as any).quick_replies = data.quick_replies.slice(0, 13);
    }
  } else if (data.type === "reaction") {
    payload.sender_action = "react";
    payload.payload = {
      message_id: data.reaction?.message_id || "",
      reaction: data.reaction?.emoji || "",
    };
  } else if (["image", "audio", "video", "document", "sticker"].includes(data.type)) {
    const media = data[data.type as keyof InstagramOutboundPayloadData] as
      | { id?: string | null; link?: string | null }
      | undefined;
    let attachmentType = data.type;
    if (attachmentType === "document") attachmentType = "file";
    if (attachmentType === "sticker") attachmentType = "image";
    const attachmentId = media?.id || "";
    const mediaUrl = media?.link || "";

    payload.message = {
      attachment: {
        type: attachmentType,
        payload: attachmentId ? { attachment_id: attachmentId } : { url: mediaUrl },
      },
    };
  }

  return payload;
}
