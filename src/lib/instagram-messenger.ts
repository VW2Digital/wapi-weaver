interface InstagramSendParams {
  igUserId: string
  accessToken: string
  recipientId: string
  data: {
    type: string
    text?: { body: string; preview_url?: boolean }
    reaction?: { message_id: string; emoji: string }
    image?: { id?: string; link?: string }
    audio?: { id?: string; link?: string }
    video?: { id?: string; link?: string }
    document?: { id?: string; link?: string; filename?: string }
  }
  replyToMessageId?: string
}

interface InstagramSendResult {
  ok: boolean
  wamid: string | null
  body: any
  error?: string
}

export async function sendInstagramMessage(
  params: InstagramSendParams,
): Promise<InstagramSendResult> {
  const apiVersion = process.env.META_GRAPH_VERSION || "v21.0"

  const payload: any = {
    recipient: { id: params.recipientId },
  }

  if (params.replyToMessageId) {
    payload.context = { message_id: params.replyToMessageId }
  }

  if (params.data.type === "text") {
    payload.message = { text: params.data.text?.body || "" }
  } else if (params.data.type === "reaction") {
    payload.sender_action = "react"
    payload.payload = {
      message_id: params.data.reaction?.message_id || "",
      reaction: params.data.reaction?.emoji || "",
    }
  } else if (["image", "audio", "video", "document"].includes(params.data.type)) {
    let attachmentType = params.data.type
    if (attachmentType === "document") attachmentType = "file"

    const media = params.data[attachmentType as keyof typeof params.data] as
      | { id?: string; link?: string }
      | undefined
    const attachmentId = media?.id || ""
    const mediaUrl = media?.link || ""

    payload.message = {
      attachment: {
        type: attachmentType,
        payload: attachmentId ? { attachment_id: attachmentId } : { url: mediaUrl },
      },
    }
  }

  try {
    const r = await fetch(
      `https://graph.instagram.com/${apiVersion}/${params.igUserId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    )

    const body = await r.json()

    if (!r.ok) {
      return {
        ok: false,
        wamid: null,
        body,
        error: body?.error?.message ?? "Falha ao enviar DM no Instagram.",
      }
    }

    return {
      ok: true,
      wamid: body?.message_id || null,
      body,
    }
  } catch (e: any) {
    return {
      ok: false,
      wamid: null,
      body: null,
      error: e.message || "Erro de rede ao enviar mensagem no Instagram.",
    }
  }
}
