type JsonObject = Record<string, unknown>;

export type WhatsAppBotStep = {
  message_type?: string | null;
  message_content?: string | null;
  media_url?: string | null;
  media_caption?: string | null;
  footer_text?: string | null;
  buttons_config?: unknown;
};

export type WhatsAppMessageBuildResult = {
  payload: JsonObject;
  fallbackReason?: string;
};

function textPayload(to: string, body: string, contextMessageId?: string | null): JsonObject {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}),
    type: "text",
    text: { preview_url: false, body: body.slice(0, 4096) || "Olá! Como posso ajudar?" },
  };
}

function readConfig(value: unknown): JsonObject | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : null;
  } catch {
    return null;
  }
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function resolveMediaReference(reference: string): { isUrl: boolean; value: string } {
  const trimmed = reference.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return { isUrl: true, value: trimmed };
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("uploads/")) {
    const baseUrl = (process.env.APP_URL || process.env.PUBLIC_URL || "http://localhost:8080").replace(/\/+$/, "");
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return { isUrl: true, value: `${baseUrl}${cleanPath}` };
  }
  return { isUrl: false, value: trimmed };
}

function detectMediaType(urlOrId: string, explicitType?: string | null): "image" | "video" | "audio" | "document" | "sticker" {
  const type = String(explicitType || "").toLowerCase();
  if (["image", "video", "audio", "document", "sticker"].includes(type)) {
    return type as "image" | "video" | "audio" | "document" | "sticker";
  }
  const clean = urlOrId.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext) || urlOrId.startsWith("data:image")) return "image";
  if (["mp4", "mov", "webm", "avi", "3gp", "m4v"].includes(ext) || urlOrId.startsWith("data:video")) return "video";
  if (["mp3", "ogg", "wav", "m4a", "aac", "opus"].includes(ext) || urlOrId.startsWith("data:audio")) return "audio";
  if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "zip"].includes(ext) || urlOrId.startsWith("data:application")) return "document";
  return "image";
}

function getFilenameFromUrl(url: string, defaultName = "document.pdf"): string {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const parts = clean.split("/");
    const last = parts.pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {}
  return defaultName;
}

/**
 * Produz somente payloads aceitos pelo endpoint /{phone-number-id}/messages.
 * Ações internas do construtor (IA, criar conversa e CTA livre) nunca são
 * enviadas como `type` para a Meta: elas recebem um texto seguro como fallback.
 */
export function buildWhatsAppBotMessage(
  to: string,
  step: WhatsAppBotStep,
  contextMessageId?: string | null,
): WhatsAppMessageBuildResult {
  const type = String(step.message_type || "text").toLowerCase();
  const body = String(step.message_content || "").trim();
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}),
  };

  const mediaRefRaw = String(step.media_url || "").trim();
  const mediaRef = mediaRefRaw ? resolveMediaReference(mediaRefRaw) : null;
  const config = readConfig(step.buttons_config);
  const action = asObject(config?.action);

  // 1. Botões interativos (buttons, image_buttons, dynamic_buttons)
  if (type === "buttons" || type === "image_buttons" || type === "dynamic_buttons") {
    const buttons = Array.isArray(action?.buttons)
      ? action.buttons
          .map(asObject)
          .map((button) => {
            const reply = asObject(button?.reply);
            const id = String(reply?.id || "").trim();
            const title = String(reply?.title || "").trim();
            return id && title ? { type: "reply", reply: { id: id.slice(0, 256), title: title.slice(0, 20) } } : null;
          })
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (buttons.length) {
      let headerObj: JsonObject | null = null;
      if (mediaRef) {
        const headerMediaType = detectMediaType(mediaRef.value, type === "image_buttons" ? "image" : null);
        const mediaObj: JsonObject = mediaRef.isUrl ? { link: mediaRef.value } : { id: mediaRef.value };

        if (headerMediaType === "document") {
          headerObj = {
            type: "document",
            document: {
              ...mediaObj,
              filename: getFilenameFromUrl(mediaRef.value, "document.pdf"),
            },
          };
        } else if (headerMediaType === "video") {
          headerObj = {
            type: "video",
            video: mediaObj,
          };
        } else {
          headerObj = {
            type: "image",
            image: mediaObj,
          };
        }
      }

      return {
        payload: {
          ...base,
          type: "interactive",
          interactive: {
            type: "button",
            ...(headerObj ? { header: headerObj } : {}),
            body: { text: body.slice(0, 1024) || "Escolha uma opção" },
            ...(step.footer_text ? { footer: { text: String(step.footer_text).slice(0, 60) } } : {}),
            action: { buttons },
          },
        },
      };
    }
  }

  // 2. Lista dinâmica / Menu (list)
  if (type === "list") {
    const rawSections = Array.isArray(action?.sections) ? action.sections : [];
    const sections = rawSections
      .map(asObject)
      .map((section) => {
        const rows = Array.isArray(section?.rows)
          ? section.rows
              .map(asObject)
              .map((row) => {
                const id = String(row?.id || "").trim();
                const title = String(row?.title || "").trim();
                return id && title
                  ? {
                      id: id.slice(0, 200),
                      title: title.slice(0, 24),
                      ...(row?.description ? { description: String(row.description).slice(0, 72) } : {}),
                    }
                  : null;
              })
              .filter(Boolean)
              .slice(0, 10)
          : [];
        return rows.length ? { ...(section?.title ? { title: String(section.title).slice(0, 24) } : {}), rows } : null;
      })
      .filter(Boolean)
      .slice(0, 10);
    const button = String(action?.button || "Ver opções").trim();
    if (sections.length) {
      return {
        payload: {
          ...base,
          type: "interactive",
          interactive: {
            type: "list",
            body: { text: body.slice(0, 1024) || "Escolha uma opção" },
            ...(step.footer_text ? { footer: { text: String(step.footer_text).slice(0, 60) } } : {}),
            action: { button: button.slice(0, 20), sections },
          },
        },
      };
    }
  }

  // 3. CTA URL (cta_url)
  if (type === "cta_url") {
    const parameters = asObject(action?.parameters);
    const url = String(parameters?.url || step.media_url || "").trim();
    const displayText = String(parameters?.display_text || action?.button || "Abrir link").trim();
    if (url && /^https?:\/\//i.test(url)) {
      return {
        payload: {
          ...base,
          type: "interactive",
          interactive: {
            type: "cta_url",
            body: { text: body.slice(0, 1024) || "Acesse o link abaixo:" },
            ...(step.footer_text ? { footer: { text: String(step.footer_text).slice(0, 60) } } : {}),
            action: {
              name: "cta_url",
              parameters: {
                display_text: displayText.slice(0, 20),
                url: url.slice(0, 2000),
              },
            },
          },
        },
      };
    }
    return {
      payload: textPayload(to, [body, url].filter(Boolean).join("\n\n"), contextMessageId),
      fallbackReason: "CTA enviado como texto com URL.",
    };
  }

  // 4. Mensagem de Mídia dedicada (image, video, audio, document, sticker) OU se mediaRef estiver presente sem botões
  if (["image", "audio", "video", "document", "sticker"].includes(type) || mediaRef) {
    if (!mediaRef) {
      return {
        payload: textPayload(to, body, contextMessageId),
        fallbackReason: `A etapa ${type} não possui mídia configurada.`,
      };
    }

    const targetType = detectMediaType(mediaRef.value, type);
    const media: JsonObject = mediaRef.isUrl ? { link: mediaRef.value } : { id: mediaRef.value };

    const captionText = String(step.media_caption || body).trim();
    if (captionText && ["image", "video", "document"].includes(targetType)) {
      media.caption = captionText.slice(0, 1024);
    }
    if (targetType === "document") {
      media.filename = getFilenameFromUrl(mediaRef.value, "document.pdf");
    }

    return { payload: { ...base, type: targetType, [targetType]: media } };
  }

  // 5. Localização
  if (type === "location") {
    let lat = -1.4558;
    let long = -48.4814;
    if (mediaRefRaw && mediaRefRaw.includes(",")) {
      const parts = mediaRefRaw.split(",");
      const pLat = parseFloat(parts[0]);
      const pLong = parseFloat(parts[1]);
      if (!isNaN(pLat) && !isNaN(pLong)) {
        lat = pLat;
        long = pLong;
      }
    }
    return {
      payload: {
        ...base,
        type: "location",
        location: {
          latitude: lat,
          longitude: long,
          name: "Localização",
          ...(body ? { address: body.slice(0, 1000) } : {}),
        },
      },
    };
  }

  // 5. Ações internas do construtor
  if (type === "link_ai_agent") {
    return {
      payload: textPayload(to, "Não consegui acionar o assistente automático agora. Um atendente seguirá com você.", contextMessageId),
      fallbackReason: "Agente IA indisponível; enviada mensagem de contingência.",
    };
  }

  if (type === "create_chat") {
    return {
      payload: textPayload(to, body || "Seu atendimento foi iniciado.", contextMessageId),
      fallbackReason: "Ação de criar conversa convertida em confirmação de atendimento.",
    };
  }

  return {
    payload: textPayload(to, body, contextMessageId),
  };
}
