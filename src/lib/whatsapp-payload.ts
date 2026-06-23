// Builds payloads accepted by https://graph.facebook.com/v20.0/{phone_id}/messages
// WhatsApp Cloud API expects E.164 sem o sinal de '+', ex: "5511999999999"
function toE164NoPlus(raw: string): string {
  return String(raw ?? "").replace(/\D+/g, "");
}

function extractTemplateTokens(text: string): string[] {
  const matches = String(text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
  return matches
    .map((match) => match.replace(/^\{\{\s*|\s*\}\}$/g, "").trim())
    .filter(Boolean);
}

export function buildWhatsAppPayload(
  messageType: string,
  toPhone: string,
  payload: any,
  contact?: { name?: string | null; custom_fields?: any },
) {
  const base: any = { messaging_product: "whatsapp", to: toE164NoPlus(toPhone) };

  const interpolate = (s: string) =>
    s.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, rawKey) => {
      const key = rawKey.trim();
      const lowerKey = key.toLowerCase();

      // Suporte para {{name}}, {{Name}}, {{nome}}, {{Nome}}
      if (lowerKey === "name" || lowerKey === "nome") {
        return contact?.name ?? "";
      }

      if (contact?.custom_fields) {
        // Busca exata primeiro (respeitando maiúsculas/minúsculas e acentos)
        if (key in contact.custom_fields) {
          return String(contact.custom_fields[key] ?? "");
        }

        // Busca insensível a maiúsculas/minúsculas (ex: {{Cidade}} ou {{cidade}})
        for (const [k, val] of Object.entries(contact.custom_fields)) {
          if (k.toLowerCase().trim() === lowerKey) {
            return String(val ?? "");
          }
        }
      }
      return "";
    });

  if (messageType === "template") {
    const components: any[] = [];
    const variableValues = Array.isArray(payload.variables) ? payload.variables : [];
    const templateComponents = Array.isArray(payload.template_components) ? payload.template_components : [];
    const placeholderKeys = Array.isArray(payload.template_placeholders)
      ? payload.template_placeholders
      : variableValues.map((_: string, index: number) => String(index + 1));
    const isNamedFormat = payload.parameter_format === "NAMED";
    const valuesByToken = new Map<string, string>();

    placeholderKeys.forEach((token: string, index: number) => {
      valuesByToken.set(String(token), interpolate(variableValues[index] ?? ""));
    });

    const makeTextParameters = (tokens: string[]) =>
      tokens.map((token) => {
        const normalized = String(token).trim();
        const text = valuesByToken.get(normalized) ?? "";
        return isNamedFormat && !/^\d+$/.test(normalized)
          ? { type: "text", parameter_name: normalized, text }
          : { type: "text", text };
      });

    if (payload.header_image_url) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: payload.header_image_url } }],
      });
    }

    if (templateComponents.length > 0) {
      for (const component of templateComponents) {
        if (component?.type === "HEADER" && component.format === "TEXT") {
          const tokens = extractTemplateTokens(component.text ?? "");
          if (tokens.length > 0) {
            components.push({ type: "header", parameters: makeTextParameters(tokens) });
          }
        }

        if (component?.type === "BODY") {
          const tokens = extractTemplateTokens(component.text ?? "");
          if (tokens.length > 0) {
            components.push({ type: "body", parameters: makeTextParameters(tokens) });
          }
        }

        if (component?.type === "BUTTONS" && Array.isArray(component.buttons)) {
          component.buttons.forEach((button: any, index: number) => {
            const urlTokens = extractTemplateTokens(button?.url ?? "");
            if (button?.type === "URL" && urlTokens.length > 0) {
              components.push({
                type: "button",
                sub_type: "url",
                index: String(index),
                parameters: makeTextParameters(urlTokens),
              });
            }
          });
        }
      }
    } else if (payload.variables?.length) {
      components.push({
        type: "body",
        parameters: payload.variables.map((v: string) => ({ type: "text", text: interpolate(v) })),
      });
    }

    return {
      ...base,
      type: "template",
      template: {
        name: payload.template_name,
        language: { code: payload.language },
        ...(components.length ? { components } : {}),
      },
    };
  }

  if (messageType === "text") {
    return { ...base, type: "text", text: { body: interpolate(payload.text ?? "") } };
  }

  if (messageType === "media") {
    const mt = payload.media_type ?? "image";
    return {
      ...base,
      type: mt,
      [mt]: {
        link: payload.media_url,
        ...(payload.caption ? { caption: interpolate(payload.caption) } : {}),
        ...(payload.filename && mt === "document" ? { filename: payload.filename } : {}),
      },
    };
  }

  if (messageType === "interactive") {
    return { ...base, type: "interactive", interactive: payload.interactive ?? payload };
  }

  throw new Error(`Tipo de mensagem desconhecido: ${messageType}`);
}
