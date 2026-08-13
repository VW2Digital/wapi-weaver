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

  if (type === "text" || !type) return { payload: textPayload(to, body, contextMessageId) };

  if (["image", "audio", "video", "document", "sticker"].includes(type)) {
    const reference = String(step.media_url || "").trim();
    if (!reference) {
      return {
        payload: textPayload(to, body, contextMessageId),
        fallbackReason: `A etapa ${type} não possui mídia configurada.`,
      };
    }
    const media: JsonObject = /^https?:\/\//i.test(reference) ? { link: reference } : { id: reference };
    if (step.media_caption && ["image", "video", "document"].includes(type)) {
      media.caption = String(step.media_caption).slice(0, 1024);
    }
    return { payload: { ...base, type, [type]: media } };
  }

  const config = readConfig(step.buttons_config);
  const action = asObject(config?.action);
  if (type === "buttons") {
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
      return {
        payload: {
          ...base,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: body.slice(0, 1024) || "Escolha uma opção" },
            ...(step.footer_text ? { footer: { text: String(step.footer_text).slice(0, 60) } } : {}),
            action: { buttons },
          },
        },
      };
    }
  }

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

  // CTA por URL livre não é uma mensagem interativa livre da Cloud API; use URL no texto.
  if (type === "cta_url") {
    const parameters = asObject(action?.parameters);
    const url = String(parameters?.url || "").trim();
    return {
      payload: textPayload(to, [body, url].filter(Boolean).join("\n\n"), contextMessageId),
      fallbackReason: "CTA enviado como texto com URL, formato compatível com a Cloud API.",
    };
  }

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
    fallbackReason: `Tipo de etapa interno não enviável pela Meta: ${type}.`,
  };
}
