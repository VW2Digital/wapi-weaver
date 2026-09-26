export type ParameterFormat = "NAMED" | "POSITIONAL";

export type TemplateHeaderInput =
  | { format: "NONE" }
  | { format: "TEXT"; text: string; examples?: string[] }
  | { format: "IMAGE" | "VIDEO" | "DOCUMENT"; header_handle: string }
  | { format: "LOCATION" };

export type TemplateButtonInput =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "COPY_CODE"; example: string[] }
  | { type: "CATALOG"; text: string }
  | { type: "MPM"; text: string }
  | {
      type: "FLOW";
      text: string;
      flow_id: string;
      flow_action: "navigate" | "data_exchange";
      navigate_screen?: string;
    }
  | {
      type: "OTP";
      otp_type: "COPY_CODE" | "ONE_TAP" | "ZERO_TAP";
      text?: string;
      autofill_text?: string;
      package_name?: string;
      signature_hash?: string;
    }
  | { type: "VOICE_CALL"; text: string };

export type BuildTemplateInput = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  header: TemplateHeaderInput;
  body: string;
  body_examples?: string[];
  footer?: string;
  buttons?: TemplateButtonInput[];
  parameter_format?: ParameterFormat;
  allow_category_change?: boolean;
  cta_url_link_tracking_opted_out?: boolean;
  message_send_ttl_seconds?: number;
  sub_category?: string;
  display_format?: string;
  is_primary_device_delivery_only?: boolean;
};

export type FieldErrors = Record<string, string>;

export class TemplateFieldError extends Error {
  fields: FieldErrors;
  constructor(message: string, fields: FieldErrors = {}) {
    super(message);
    this.name = "TemplateFieldError";
    this.fields = fields;
  }
}

export function extractPlaceholders(text: string): string[] {
  const matches = String(text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
  const placeholders: string[] = [];
  for (const match of matches) {
    const token = match.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
    if (token && !placeholders.includes(token)) placeholders.push(token);
  }
  return placeholders;
}

export function inferParameterFormat(placeholders: string[]): ParameterFormat | "EMPTY" | "MIXED" {
  if (placeholders.length === 0) return "EMPTY";
  const named = placeholders.filter((p) => !/^\d+$/.test(p));
  const positional = placeholders.filter((p) => /^\d+$/.test(p));
  if (named.length && positional.length) return "MIXED";
  if (named.length) return "NAMED";
  return "POSITIONAL";
}

export function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export function parseBlivStorageFilePath(raw: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const fromUrl = (href: string, base?: string): string | null => {
    try {
      const url = base ? new URL(href, base) : new URL(href);
      const pathname = url.pathname.replace(/\/+$/, "");
      if (
        pathname.endsWith("/api/storage/file") ||
        pathname.endsWith("/api/storage/global-file")
      ) {
        const filePath = url.searchParams.get("path")?.trim();
        return filePath || null;
      }
    } catch {
      return null;
    }
    return null;
  };

  if (/^https?:\/\//i.test(value)) return fromUrl(value);
  if (value.startsWith("/")) return fromUrl(value, "https://bliv.invalid");
  const marker = value.indexOf("/api/storage/file");
  if (marker >= 0) {
    const query = value.slice(value.indexOf("?", marker));
    if (query.startsWith("?")) {
      const filePath = new URLSearchParams(query.slice(1)).get("path")?.trim();
      if (filePath) return filePath;
    }
  }
  return null;
}

export function looksLikeMetaUploadHandle(value: string): boolean {
  const v = String(value || "").trim();
  if (!v || looksLikeHttpUrl(v)) return false;
  if (/placeholder|local-draft|pending-server/i.test(v)) return false;
  // UUID, filename or library path is never a Meta resumable handle.
  if (v.includes("/") || /\.(png|jpe?g|gif|webp|mp4|pdf)$/i.test(v)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return false;
  // Current Graph handles start with "4:"; some older sessions used "2:".
  return /^(4|2):[A-Za-z0-9+/=:_-]{20,}$/.test(v);
}

export function buttonCompatibility(category: BuildTemplateInput["category"]): {
  allowed: TemplateButtonInput["type"][];
  reason: Record<string, string>;
} {
  const reason: Record<string, string> = {};
  if (category === "AUTHENTICATION") {
    reason.QUICK_REPLY = "Templates de autenticação só aceitam botão OTP.";
    reason.URL = "Templates de autenticação só aceitam botão OTP.";
    reason.PHONE_NUMBER = "Templates de autenticação só aceitam botão OTP.";
    reason.COPY_CODE = "Use o botão OTP (copy code), não COPY_CODE avulso.";
    reason.CATALOG = "Catálogo não é permitido em autenticação.";
    reason.MPM = "Multi-produto não é permitido em autenticação.";
    reason.FLOW = "Flow não é permitido em autenticação.";
    reason.VOICE_CALL = "Chamada de voz não é permitida em autenticação.";
    return { allowed: ["OTP"], reason };
  }
  reason.OTP = "Botão OTP só pode ser usado na categoria Autenticação.";
  const allowed: TemplateButtonInput["type"][] = [
    "QUICK_REPLY",
    "URL",
    "PHONE_NUMBER",
    "COPY_CODE",
    "CATALOG",
    "MPM",
    "FLOW",
    "VOICE_CALL",
  ];
  return { allowed, reason };
}

export function headerCompatibility(category: BuildTemplateInput["category"]): {
  allowed: TemplateHeaderInput["format"][];
  reason: Record<string, string>;
} {
  if (category === "AUTHENTICATION") {
    return {
      allowed: ["NONE", "TEXT"],
      reason: {
        IMAGE: "Autenticação não aceita cabeçalho de mídia.",
        VIDEO: "Autenticação não aceita cabeçalho de mídia.",
        DOCUMENT: "Autenticação não aceita cabeçalho de mídia.",
        LOCATION: "Autenticação não aceita cabeçalho de localização.",
      },
    };
  }
  return {
    allowed: ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"],
    reason: {},
  };
}

function compactButton(button: TemplateButtonInput): Record<string, unknown> {
  if (button.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: button.text.trim() };
  if (button.type === "URL") {
    const out: Record<string, unknown> = {
      type: "URL",
      text: button.text.trim(),
      url: button.url.trim(),
    };
    if (button.example?.[0]?.trim()) out.example = [button.example[0].trim()];
    return out;
  }
  if (button.type === "PHONE_NUMBER") {
    return { type: "PHONE_NUMBER", text: button.text.trim(), phone_number: button.phone_number.trim() };
  }
  if (button.type === "COPY_CODE") {
    return { type: "COPY_CODE", example: [String(button.example?.[0] || "").trim()] };
  }
  if (button.type === "CATALOG") return { type: "CATALOG", text: button.text.trim() };
  if (button.type === "MPM") return { type: "MPM", text: button.text.trim() };
  if (button.type === "FLOW") {
    const out: Record<string, unknown> = {
      type: "FLOW",
      text: button.text.trim(),
      flow_id: button.flow_id.trim(),
      flow_action: button.flow_action,
    };
    if (button.flow_action === "navigate" && button.navigate_screen?.trim()) {
      out.navigate_screen = button.navigate_screen.trim();
    }
    return out;
  }
  if (button.type === "OTP") {
    const out: Record<string, unknown> = { type: "OTP", otp_type: button.otp_type };
    if (button.text?.trim()) out.text = button.text.trim();
    if (button.otp_type !== "COPY_CODE") {
      if (button.autofill_text?.trim()) out.autofill_text = button.autofill_text.trim();
      if (button.package_name?.trim()) out.package_name = button.package_name.trim();
      if (button.signature_hash?.trim()) out.signature_hash = button.signature_hash.trim();
    }
    return out;
  }
  return { type: "VOICE_CALL", text: button.text.trim() };
}

export function validateTemplateInput(input: BuildTemplateInput): FieldErrors {
  const fields: FieldErrors = {};
  const bodyVars = extractPlaceholders(input.body);
  const inferred = inferParameterFormat(bodyVars);
  const format: ParameterFormat =
    input.parameter_format || (inferred === "NAMED" ? "NAMED" : "POSITIONAL");

  if (inferred === "MIXED") {
    fields.body = "Não misture variáveis posicionais ({{1}}) com nomeadas ({{nome}}) no mesmo texto.";
  }
  if (input.parameter_format === "NAMED" && inferred === "POSITIONAL") {
    fields.parameter_format = "Formato nomeado exige variáveis como {{primeiro_nome}}, não {{1}}.";
  }
  if (input.parameter_format === "POSITIONAL" && inferred === "NAMED") {
    fields.parameter_format = "Formato posicional exige variáveis {{1}}, {{2}}, …";
  }
  if (inferred === "POSITIONAL") {
    const nums = bodyVars.map((v) => Number(v)).sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        fields.body = "Variáveis posicionais devem ser sequenciais começando em {{1}}.";
        break;
      }
    }
  }

  if (bodyVars.length > 0) {
    const missing = bodyVars.filter((_, i) => !input.body_examples?.[i]?.trim());
    if (missing.length) {
      fields.body_examples = "Preencha um exemplo para cada variável do corpo.";
    }
  }

  const headerRules = headerCompatibility(input.category);
  if (!headerRules.allowed.includes(input.header.format)) {
    fields.header = headerRules.reason[input.header.format] || "Cabeçalho incompatível com a categoria.";
  }

  if (input.header.format === "TEXT") {
    const headerVars = extractPlaceholders(input.header.text);
    if (headerVars.length > 1) {
      fields.header_text = "O cabeçalho de texto aceita no máximo uma variável.";
    }
    if (headerVars.length === 1 && !input.header.examples?.[0]?.trim()) {
      fields.header_examples = "Informe um exemplo para a variável do cabeçalho.";
    }
  }

  if (
    input.header.format === "IMAGE" ||
    input.header.format === "VIDEO" ||
    input.header.format === "DOCUMENT"
  ) {
    const handle = input.header.header_handle?.trim() || "";
    if (!handle) {
      fields.header_media =
        "Envie o arquivo de exemplo para a Meta (upload oficial). Uma URL comum não pode ir em header_handle.";
    } else if (looksLikeHttpUrl(handle)) {
      fields.header_media =
        "header_handle deve ser o identificador do upload resumable da Meta, não uma URL http(s).";
    } else if (!looksLikeMetaUploadHandle(handle)) {
      fields.header_media = "O identificador de mídia da Meta é inválido. Envie o arquivo novamente.";
    }
  }

  if (input.category === "AUTHENTICATION" && input.footer?.trim()) {
    fields.footer = "Templates de autenticação não devem enviar rodapé.";
  }

  const btnRules = buttonCompatibility(input.category);
  const buttons = input.buttons || [];
  const types = buttons.map((b) => b.type);
  if (types.filter((t) => t === "CATALOG").length > 1) fields.buttons = "Apenas um botão Catálogo.";
  if (types.filter((t) => t === "MPM").length > 1) fields.buttons = "Apenas um botão multi-produto.";
  if (types.includes("CATALOG") && types.includes("MPM")) {
    fields.buttons = "Não combine Catálogo e Multi-produto no mesmo template.";
  }

  buttons.forEach((button, index) => {
    const key = `buttons.${index}`;
    if (!btnRules.allowed.includes(button.type)) {
      fields[key] = btnRules.reason[button.type] || "Tipo de botão incompatível com a categoria.";
      return;
    }
    if (button.type === "URL") {
      const rawUrl = button.url.trim();
      if (!rawUrl) fields[key] = "Informe a URL do botão.";
      else {
        try {
          const parsed = new URL(rawUrl.replace(/\{\{\s*[^}]+\s*\}\}/g, "sample"));
          if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname || parsed.hostname === "exemplo.com") {
            fields[key] = "Informe uma URL https válida para o botão.";
          }
        } catch {
          fields[key] = "Informe uma URL https válida para o botão.";
        }
        if (/\{\{/.test(rawUrl) && !button.example?.[0]?.trim()) {
          fields[key] = "URL com variável exige um exemplo (campo example).";
        }
      }
    }
    if (button.type === "COPY_CODE" && !button.example?.[0]?.trim()) {
      fields[key] = "Informe o código de exemplo (até 15 caracteres).";
    }
    if (button.type === "FLOW" && !button.flow_id.trim()) {
      fields[key] = "Informe o Flow ID.";
    }
    if (button.type === "OTP" && button.otp_type !== "COPY_CODE") {
      if (!button.package_name?.trim() || !button.signature_hash?.trim()) {
        fields[key] = "ONE_TAP/ZERO_TAP exigem package_name e signature_hash do Android.";
      }
    }
  });

  if (format === "NAMED" && inferred === "EMPTY" && input.parameter_format === "NAMED") {
    fields.parameter_format = "Formato nomeado só deve ser enviado quando existem variáveis nomeadas.";
  }

  return fields;
}

export function buildMetaComponents(input: BuildTemplateInput): Record<string, unknown>[] {
  const fields = validateTemplateInput(input);
  if (Object.keys(fields).length) {
    throw new TemplateFieldError(Object.values(fields)[0], fields);
  }

  const bodyVars = extractPlaceholders(input.body);
  const inferred = inferParameterFormat(bodyVars);
  const format: ParameterFormat =
    input.parameter_format || (inferred === "NAMED" ? "NAMED" : "POSITIONAL");

  const components: Record<string, unknown>[] = [];

  if (input.header.format === "TEXT") {
    const header: Record<string, unknown> = { type: "HEADER", format: "TEXT", text: input.header.text };
    const headerVars = extractPlaceholders(input.header.text);
    if (headerVars.length && input.header.examples?.[0]) {
      if (format === "NAMED" && !/^\d+$/.test(headerVars[0])) {
        header.example = {
          header_text_named_params: [
            { param_name: headerVars[0], example: input.header.examples[0] },
          ],
        };
      } else {
        header.example = { header_text: [input.header.examples[0]] };
      }
    }
    components.push(header);
  } else if (input.header.format === "LOCATION") {
    components.push({ type: "HEADER", format: "LOCATION" });
  } else if (input.header.format !== "NONE") {
    components.push({
      type: "HEADER",
      format: input.header.format,
      example: { header_handle: [input.header.header_handle] },
    });
  }

  const body: Record<string, unknown> = { type: "BODY", text: input.body };
  if (bodyVars.length && input.body_examples?.length) {
    if (format === "NAMED") {
      body.example = {
        body_text_named_params: bodyVars.map((param_name, index) => ({
          param_name,
          example: input.body_examples?.[index] ?? "",
        })),
      };
    } else {
      body.example = { body_text: [input.body_examples.slice(0, bodyVars.length)] };
    }
  }
  components.push(body);

  if (input.footer?.trim() && input.category !== "AUTHENTICATION") {
    components.push({ type: "FOOTER", text: input.footer.trim() });
  }

  if (input.buttons?.length) {
    components.push({ type: "BUTTONS", buttons: input.buttons.map(compactButton) });
  }

  return components;
}

export function stripBlivTemplateFields(
  components: Record<string, unknown>[],
): Record<string, unknown>[] {
  return components.map((component) => {
    const copy = { ...component } as Record<string, unknown>;
    delete copy._bliv;
    return copy;
  });
}

export function compactMetaCreatePayload(
  input: BuildTemplateInput,
  components: Record<string, unknown>[],
): Record<string, unknown> {
  const bodyVars = extractPlaceholders(input.body);
  const inferred = inferParameterFormat(bodyVars);
  const payload: Record<string, unknown> = {
    name: input.name,
    language: input.language,
    category: input.category,
    components: stripBlivTemplateFields(components),
  };
  if (input.parameter_format === "NAMED" || inferred === "NAMED") {
    payload.parameter_format = "NAMED";
  }
  if (input.allow_category_change === false) payload.allow_category_change = false;
  if (input.cta_url_link_tracking_opted_out === true) {
    payload.cta_url_link_tracking_opted_out = true;
  }
  if (input.message_send_ttl_seconds && input.message_send_ttl_seconds > 0) {
    payload.message_send_ttl_seconds = input.message_send_ttl_seconds;
  }
  if (input.sub_category) payload.sub_category = input.sub_category;
  if (input.display_format) payload.display_format = input.display_format;
  if (input.is_primary_device_delivery_only === true) {
    payload.is_primary_device_delivery_only = true;
  }
  return payload;
}

export function serializeTemplateFieldError(err: TemplateFieldError): string {
  return `TEMPLATE_FIELDS:${JSON.stringify({ message: err.message, fields: err.fields })}`;
}

export function parseTemplateFieldError(
  message: string,
): { message: string; fields: FieldErrors } | null {
  const raw = String(message || "");
  const marker = "TEMPLATE_FIELDS:";
  const idx = raw.indexOf(marker);
  if (idx < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(idx + marker.length));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      message: String(parsed.message || "Há campos inválidos no template."),
      fields: parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {},
    };
  } catch {
    return null;
  }
}

export function sanitizePayloadForLog(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const components = Array.isArray(clone.components) ? clone.components : [];
  for (const component of components as any[]) {
    const handle = component?.example?.header_handle?.[0];
    if (typeof handle === "string" && handle.length > 16) {
      component.example.header_handle = [`${handle.slice(0, 8)}…(${handle.length} chars)`];
    }
  }
  return clone;
}

/** Fields safe to request on GET /{MESSAGE_TEMPLATE_ID}. `bid_spec` was retired after 2026-07-31. */
export const META_TEMPLATE_DETAIL_FIELDS = [
  "id",
  "name",
  "language",
  "status",
  "category",
  "components",
  "quality_score",
  "rejected_reason",
  "sub_category",
  "last_updated_time",
  "parameter_format",
  "cta_url_link_tracking_opted_out",
  "message_send_ttl_seconds",
  "is_primary_device_delivery_only",
  "health_status",
  "previous_category",
  "correct_category",
  "library_template_name",
  "optimization_spec",
] as const;

export function dropUnknownGraphField<T extends string>(
  fields: readonly T[],
  message: string,
): T[] | null {
  const match = String(message || "").match(/nonexisting field \(([^)]+)\)/i);
  if (!match) return null;
  const unknown = match[1].trim();
  const next = fields.filter((field) => field !== unknown);
  return next.length > 0 && next.length < fields.length ? next : null;
}
