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

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
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

    if (!hasValue(base.to) || !hasValue(payload.template_name) || !hasValue(payload.language)) {
      throw new Error(
        `Parâmetro obrigatório ausente: ${JSON.stringify({
          to: base.to,
          template_name: payload.template_name ?? null,
          language_code: payload.language ?? null,
        })}`,
      );
    }

    const requiredTextTokens = new Set<string>();
    let headerMediaRequirement: "image" | "video" | "document" | null = null;
    for (const component of templateComponents) {
      if (component?.type === "HEADER") {
        if (component.format === "TEXT") {
          extractTemplateTokens(component.text ?? "").forEach((token) => requiredTextTokens.add(token));
        }
        if (component.format === "IMAGE") headerMediaRequirement = "image";
        if (component.format === "VIDEO") headerMediaRequirement = "video";
        if (component.format === "DOCUMENT") headerMediaRequirement = "document";
      }
      if (component?.type === "BODY") {
        extractTemplateTokens(component.text ?? "").forEach((token) => requiredTextTokens.add(token));
      }
      if (component?.type === "BUTTONS" && Array.isArray(component.buttons)) {
        component.buttons.forEach((button: any) => {
          if (button?.type === "URL") {
            extractTemplateTokens(button?.url ?? "").forEach((token) => requiredTextTokens.add(token));
          }
        });
      }
    }

    const missingTokens = Array.from(requiredTextTokens).filter((token) => !hasValue(valuesByToken.get(token)));
    if (missingTokens.length > 0) {
      throw new Error(
        `Variáveis obrigatórias do template não foram preenchidas: ${missingTokens
          .map((token) => `{{${token}}}`)
          .join(", ")}`,
      );
    }

    const makeTextParameters = (tokens: string[], prefix?: string) =>
      tokens.map((token) => {
        const normalized = String(token).trim();
        const lookupKey = prefix ? `${prefix}${normalized}` : normalized;
        const text = (valuesByToken.has(lookupKey) ? valuesByToken.get(lookupKey) : valuesByToken.get(normalized)) ?? "";
        return isNamedFormat && !/^\d+$/.test(normalized)
          ? { type: "text", parameter_name: normalized, text }
          : { type: "text", text };
      });

    if (headerMediaRequirement === "image") {
      const imageId = payload.header_media_id ?? payload.header_image_id;
      const imageLink = payload.header_media_link ?? payload.header_image_url;
      if (!hasValue(imageId) && !hasValue(imageLink)) {
        throw new Error(
          "Este template exige uma imagem no cabeçalho. Informe o ID ou a URL pública da imagem antes de enviar a campanha.",
        );
      }
      components.push({
        type: "header",
        parameters: [
          imageId
            ? { type: "image", image: { id: imageId } }
            : { type: "image", image: { link: imageLink } },
        ],
      });
    }

    if (headerMediaRequirement === "video") {
      const videoId = payload.header_media_id ?? payload.header_video_id;
      const videoLink = payload.header_media_link ?? payload.header_video_url;
      if (!hasValue(videoId) && !hasValue(videoLink)) {
        throw new Error(
          "Este template exige um vídeo no cabeçalho. Informe o ID ou a URL pública do vídeo antes de enviar a campanha.",
        );
      }
      components.push({
        type: "header",
        parameters: [
          videoId
            ? { type: "video", video: { id: videoId } }
            : { type: "video", video: { link: videoLink } },
        ],
      });
    }

    if (headerMediaRequirement === "document") {
      const documentId = payload.header_media_id ?? payload.header_document_id;
      const documentLink = payload.header_media_link ?? payload.header_document_url;
      if (!hasValue(documentId) && !hasValue(documentLink)) {
        throw new Error(
          "Este template exige um documento no cabeçalho. Informe o ID ou a URL pública do documento antes de enviar a campanha.",
        );
      }
      components.push({
        type: "header",
        parameters: [
          documentId
            ? { type: "document", document: { id: documentId, filename: payload.header_document_filename } }
            : {
                type: "document",
                document: { link: documentLink, filename: payload.header_document_filename },
              },
        ],
      });
    }

    if (templateComponents.length > 0) {
      for (const component of templateComponents) {
        if (component?.type === "HEADER" && component.format === "TEXT") {
          const tokens = extractTemplateTokens(component.text ?? "");
          if (tokens.length > 0) {
            components.push({ type: "header", parameters: makeTextParameters(tokens, "header_") });
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
                parameters: makeTextParameters(urlTokens, `button_${index}_`),
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
        components,
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
