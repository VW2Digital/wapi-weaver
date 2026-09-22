"use server";

export type InstagramAuthMode = "facebook_login" | "instagram_login";

export interface InstagramSendPayload {
  recipient: { id?: string; comment_id?: string };
  message_type?: "RESPONSE" | "MESSAGE_TAG";
  tag?: "HUMAN_AGENT";
  context?: { message_id: string };
  message?: Record<string, unknown>;
  sender_action?: string;
  payload?: Record<string, unknown>;
}

export interface InstagramOutboundPayloadData {
  type: string;
  text?: { body: string; preview_url?: boolean } | null;
  reaction?: { message_id: string; emoji?: string | null; action?: "react" | "unreact" } | null;
  image?: { id?: string | null; link?: string | null } | null;
  audio?: { id?: string | null; link?: string | null } | null;
  video?: { id?: string | null; link?: string | null } | null;
  document?: { id?: string | null; link?: string | null; filename?: string | null } | null;
  sticker?: { id?: string | null; link?: string | null } | null;
  quick_replies?: Array<{ content_type: "text"; title: string; payload: string }> | null;
  template?: {
    template_type: "generic" | "button";
    text?: string;
    buttons?: Array<{ type: string; title: string; url?: string; payload?: string }>;
    elements?: Array<{
      title: string;
      subtitle?: string;
      image_url?: string;
      buttons?: Array<{ type: string; title: string; url?: string; payload?: string }>;
    }>;
  } | null;
  media_share?: { id: string } | null;
  comment_id?: string | null;
}

export function resolveInstagramAuthMode(input: {
  pageId?: string | null;
  authMode?: string | null;
}): InstagramAuthMode {
  if (input.authMode === "instagram_login" || input.authMode === "facebook_login") {
    return input.authMode;
  }
  return input.pageId ? "facebook_login" : "instagram_login";
}

function mediaUrlOrId(
  authMode: InstagramAuthMode,
  media?: { id?: string | null; link?: string | null } | null,
) {
  const url = media?.link || "";
  const id = media?.id || "";
  if (authMode === "instagram_login") {
    return { url };
  }
  return id ? { attachment_id: id } : { url };
}

function clipQuickReplies(
  replies: InstagramOutboundPayloadData["quick_replies"],
) {
  return (replies || [])
    .filter((item) => item.content_type === "text" && item.title && item.payload)
    .slice(0, 13)
    .map((item) => ({
      content_type: "text" as const,
      title: item.title.slice(0, 20),
      payload: item.payload.slice(0, 1000),
    }));
}

export function buildInstagramOutboundPayload(
  recipientId: string,
  data: InstagramOutboundPayloadData,
  options: {
    replyToMessageId?: string | null;
    useHumanAgentTag?: boolean;
    authMode?: InstagramAuthMode;
  } = {},
): InstagramSendPayload {
  const authMode = options.authMode || "facebook_login";
  const payload: InstagramSendPayload = data.comment_id
    ? { recipient: { comment_id: data.comment_id } }
    : { recipient: { id: recipientId } };

  if (authMode === "facebook_login") {
    payload.message_type = options.useHumanAgentTag ? "MESSAGE_TAG" : "RESPONSE";
    if (options.useHumanAgentTag) {
      payload.tag = "HUMAN_AGENT";
    }
  }

  if (options.replyToMessageId) {
    payload.context = { message_id: options.replyToMessageId };
  }

  if (data.type === "text") {
    payload.message = { text: data.text?.body || "" };
    const quickReplies = clipQuickReplies(data.quick_replies);
    if (quickReplies.length > 0) {
      payload.message.quick_replies = quickReplies;
    }
  } else if (data.type === "reaction") {
    const action = data.reaction?.action || (data.reaction?.emoji ? "react" : "unreact");
    payload.sender_action = action === "unreact" ? "unreact" : "react";
    payload.payload = {
      message_id: data.reaction?.message_id || "",
      ...(action === "unreact" ? {} : { reaction: data.reaction?.emoji || "love" }),
    };
  } else if (data.type === "sticker") {
    if (data.sticker?.link) {
      payload.message = {
        attachment: {
          type: "image",
          payload: mediaUrlOrId(authMode, data.sticker),
        },
      };
    } else {
      payload.message = {
        attachment: { type: "like_heart" },
      };
    }
  } else if (["image", "audio", "video", "document"].includes(data.type)) {
    const media = data[data.type as "image" | "audio" | "video" | "document"];
    const attachmentType = data.type === "document" ? "file" : data.type;
    payload.message = {
      attachment: {
        type: attachmentType,
        payload: mediaUrlOrId(authMode, media),
      },
    };
  } else if (data.type === "media_share" && data.media_share?.id) {
    payload.message = {
      attachment: {
        type: "MEDIA_SHARE",
        payload: { id: data.media_share.id },
      },
    };
  } else if (data.type === "generic_template" && data.template?.elements?.length) {
    payload.message = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: data.template.elements.slice(0, 10).map((element) => ({
            title: element.title.slice(0, 80),
            subtitle: element.subtitle?.slice(0, 80),
            image_url: element.image_url,
            buttons: (element.buttons || []).slice(0, 3),
          })),
        },
      },
    };
  } else if (data.type === "button_template" && data.template?.text) {
    payload.message = {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: data.template.text.slice(0, 640),
          buttons: (data.template.buttons || []).slice(0, 3),
        },
      },
    };
  }

  return payload;
}
