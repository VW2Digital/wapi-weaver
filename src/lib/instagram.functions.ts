const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[instagram] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[instagram] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[instagram] ${msg}`, ...args),
};

export interface InstagramSendParams {
  igUserId: string;
  accessToken: string;
  recipientId: string;
  data: {
    type: string;
    text?: { body: string; preview_url?: boolean };
    reaction?: { message_id: string; emoji: string };
    image?: { id?: string; link?: string };
    audio?: { id?: string; link?: string };
    video?: { id?: string; link?: string };
    document?: { id?: string; link?: string; filename?: string };
    quick_replies?: Array<{ content_type: "text"; title: string; payload: string }>;
  };
  replyToMessageId?: string;
  useHumanAgentTag?: boolean; // For messages outside 24h window
}

export interface InstagramSendResult {
  ok: boolean;
  wamid: string | null;
  body: any;
  error?: string;
  retries?: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export function buildInstagramGraphUrl(
  nodeId: string,
  path = "",
  configuredVersion = process.env.META_GRAPH_VERSION || "v26.0",
) {
  const apiVersion = configuredVersion.startsWith("v")
    ? configuredVersion
    : `v${configuredVersion}`;
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(nodeId)}${suffix}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logInfo(message: string, meta?: any) {
  console.log(`[Instagram API] ${message}`, meta ? JSON.stringify(meta) : "");
}

function logError(message: string, error?: any) {
  console.error(`[Instagram API Error] ${message}`, error ? JSON.stringify(error) : "");
}

export async function sendInstagramMessage(
  params: InstagramSendParams,
): Promise<InstagramSendResult> {
  const payload: any = {
    recipient: { id: params.recipientId },
  };

  if (params.useHumanAgentTag) {
    payload.message_type = "MESSAGE_TAG";
    payload.tag = "HUMAN_AGENT";
  } else {
    payload.message_type = "RESPONSE";
  }

  if (params.replyToMessageId) {
    payload.context = { message_id: params.replyToMessageId };
  }

  if (params.data.type === "text") {
    payload.message = { text: params.data.text?.body || "" };
    if (params.data.quick_replies && params.data.quick_replies.length > 0) {
      payload.message.quick_replies = params.data.quick_replies.slice(0, 13);
    }
  } else if (params.data.type === "reaction") {
    payload.sender_action = "react";
    payload.payload = {
      message_id: params.data.reaction?.message_id || "",
      reaction: params.data.reaction?.emoji || "",
    };
  } else if (["image", "audio", "video", "document", "sticker"].includes(params.data.type)) {
    const media = params.data[params.data.type as keyof typeof params.data] as
      | { id?: string; link?: string }
      | undefined;
    let attachmentType = params.data.type;
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

  // Esta integração usa Instagram API with Facebook Login e Page Access
  // Token. O mesmo token é validado em graph.facebook.com nas configurações.
  const url = buildInstagramGraphUrl(params.igUserId, "messages");
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logInfo(`Sending message to ${params.recipientId} (Attempt ${attempt})`, {
        url,
        type: params.data.type,
      });

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await r.json();

      if (r.ok) {
        logInfo(`Message sent successfully to ${params.recipientId}`, { message_id: body.message_id });
        return {
          ok: true,
          wamid: body?.message_id || null,
          body,
          retries: attempt - 1,
        };
      }

      // Check for Rate Limit errors (Code 4, 17, 32, 613, or HTTP 429)
      const isRateLimit = r.status === 429 || [4, 17, 32, 613].includes(body?.error?.code);
      const isServerError = r.status >= 500;

      if ((isRateLimit || isServerError) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
        logError(`Rate limit or server error. Retrying in ${delay}ms...`, body);
        await sleep(delay);
        continue;
      }

      logError(`Failed to send message after ${attempt} attempts`, body);
      return {
        ok: false,
        wamid: null,
        body,
        error: body?.error?.message ?? "Falha ao enviar DM no Instagram.",
        retries: attempt - 1,
      };
    } catch (e: any) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
        logError(`Network error. Retrying in ${delay}ms...`, e.message);
        await sleep(delay);
        continue;
      }
      
      logError(`Network error failed after ${attempt} attempts`, e.message);
      return {
        ok: false,
        wamid: null,
        body: null,
        error: e.message || "Erro de rede ao enviar mensagem no Instagram.",
        retries: attempt - 1,
      };
    }
  }

  return { ok: false, wamid: null, body: null, error: "Retries exhausted" };
}

export async function markInstagramMessageSeen(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  messageId: string
): Promise<boolean> {
  const url = buildInstagramGraphUrl(igUserId, "messages");

  const payload = {
    recipient: { id: recipientId },
    sender_action: "mark_seen"
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const body = await r.json();
      logError("Falha ao marcar mensagem como lida no Instagram", body);
      return false;
    }
    return true;
  } catch (e: any) {
    logError("Erro de rede ao marcar mensagem como lida", e.message);
    return false;
  }
}

export async function fetchInstagramUserProfile(
  senderId: string,
  accessToken: string,
): Promise<{ name?: string; profilePic?: string } | null> {
  if (!senderId || !accessToken) return null;
  const url = `${buildInstagramGraphUrl(senderId)}?fields=name,username,profile_pic`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!r.ok) {
      return null;
    }

    const data = await r.json();
    return {
      name: data.name || data.username || undefined,
      profilePic: data.profile_pic || undefined,
    };
  } catch (e) {
    return null;
  }
}
