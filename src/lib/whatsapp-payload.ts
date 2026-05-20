// Builds payloads accepted by https://graph.facebook.com/v20.0/{phone_id}/messages
export function buildWhatsAppPayload(messageType: string, toPhone: string, payload: any, contact?: { name?: string | null; custom_fields?: any }) {
  const base: any = { messaging_product: "whatsapp", to: toPhone };

  const interpolate = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
      if (key === "name") return contact?.name ?? "";
      if (contact?.custom_fields && key in contact.custom_fields) return String(contact.custom_fields[key] ?? "");
      return "";
    });

  if (messageType === "template") {
    const components: any[] = [];
    if (payload.header_image_url) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: payload.header_image_url } }],
      });
    }
    if (payload.variables?.length) {
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
