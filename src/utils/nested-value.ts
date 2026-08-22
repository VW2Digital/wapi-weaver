/**
 * Utilitário de navegação por dot-notation em objetos aninhados.
 * Substitui o `resolveDotPath` de webhooks.server.ts, adicionando suporte
 * a bracket notation: "data[0].email" é normalizado para "data.0.email".
 */

/**
 * Navega um objeto usando dot notation (e bracket notation).
 *
 * @example
 * getNestedValue({ a: { b: [{ c: 1 }] } }, "a.b[0].c") // → 1
 * getNestedValue({ nome: "João" }, "nome")               // → "João"
 * getNestedValue({}, "a.b.c", "fallback")                // → "fallback"
 */
export function getNestedValue<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  path: string,
  defaultValue?: T,
): T | undefined {
  if (!obj || !path) return defaultValue;

  // Formulários HTML costumam enviar nomes como `form_fields[produto]`
  // literalmente. Preserve esse caso antes de interpretar os colchetes como
  // navegação em um objeto aninhado.
  if (Object.prototype.hasOwnProperty.call(obj, path)) {
    const directValue = obj[path];
    return directValue !== undefined ? (directValue as T) : defaultValue;
  }

  // Normaliza bracket notation numérica ou textual:
  // "data[0].email" → "data.0.email"
  // "form_fields[produto]" → "form_fields.produto"
  const normalizedPath = path
    .replace(/\[(["'])(.*?)\1\]/g, ".$2")
    .replace(/\[([^\]]+)\]/g, ".$1");
  const keys = normalizedPath.split(".").filter(Boolean);

  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    if (Array.isArray(current)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0) {
        current = current[index];
        continue;
      }
      return defaultValue;
    }
    if (typeof current !== "object") {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current !== undefined ? (current as T) : defaultValue;
}

// ---------------------------------------------------------------------------
// Mapeamento de campos (De-Para)
// ---------------------------------------------------------------------------

export interface FieldMapping {
  /** Campo de destino no banco (ex: "email", "name", "phone") */
  targetField: string;
  /** Caminho no payload de origem em dot notation (ex: "fields.user_email.value") */
  sourcePath: string;
}

/**
 * Aplica uma lista de mapeamentos a um `rawPayload`, extraindo os valores
 * via dot notation e montando o objeto resultante.
 *
 * @example
 * mapPayloadToStandardFields(
 *   { fields: { user_email: { value: "joao@ex.com" } } },
 *   [{ targetField: "email", sourcePath: "fields.user_email.value" }]
 * )
 * // → { email: "joao@ex.com" }
 */
export function mapPayloadToStandardFields(
  rawPayload: Record<string, unknown>,
  mappings: FieldMapping[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const value = getNestedValue(rawPayload, mapping.sourcePath);
    if (value !== undefined && value !== null) {
      result[mapping.targetField] = value;
    }
  }

  return result;
}

/**
 * Extrai de forma inteligente o nome, telefone e e-mail de um payload de webhook,
 * cobrindo estruturas de formulários externos populares (Elementor, CF7, WPForms,
 * Fluent Forms, Webflow, Typeform, Wix, HTML forms e payloads JSON genéricos).
 */
export function extractLeadInfoFromPayload(
  payload: Record<string, unknown> | null | undefined,
  mappedStandard?: Record<string, unknown> | null,
): { name: string; phone: string; email: string } {
  if (!payload && !mappedStandard) {
    return { name: "—", phone: "—", email: "—" };
  }

  const p = payload ?? {};
  const m = mappedStandard ?? {};

  // 1. Extração do Nome
  const rawName =
    m.name ??
    getNestedValue(p, "form_fields[name]") ??
    getNestedValue(p, "form_fields[nome]") ??
    getNestedValue(p, "form_fields[full_name]") ??
    getNestedValue(p, "form_fields[first_name]") ??
    getNestedValue(p, "form_fields[nome_completo]") ??
    getNestedValue(p, "form_fields[your-name]") ??
    getNestedValue(p, "form_fields[your_name]") ??
    getNestedValue(p, "form_fields.name") ??
    getNestedValue(p, "form_fields.nome") ??
    getNestedValue(p, "form_fields.full_name") ??
    getNestedValue(p, "form_fields.first_name") ??
    getNestedValue(p, "fields[name]") ??
    getNestedValue(p, "fields[nome]") ??
    getNestedValue(p, "fields.name") ??
    getNestedValue(p, "fields.nome") ??
    getNestedValue(p, "data.name") ??
    getNestedValue(p, "data.nome") ??
    getNestedValue(p, "data.full_name") ??
    getNestedValue(p, "your-name") ??
    getNestedValue(p, "your_name") ??
    getNestedValue(p, "name") ??
    getNestedValue(p, "nome") ??
    getNestedValue(p, "full_name") ??
    getNestedValue(p, "first_name") ??
    getNestedValue(p, "nome_completo") ??
    getNestedValue(p, "lead_name") ??
    getNestedValue(p, "contact_name") ??
    getNestedValue(p, "cliente") ??
    getNestedValue(p, "razao_social");

  // 2. Extração do Telefone / WhatsApp
  const rawPhone =
    m.phone ??
    getNestedValue(p, "form_fields[phone]") ??
    getNestedValue(p, "form_fields[telefone]") ??
    getNestedValue(p, "form_fields[whatsapp]") ??
    getNestedValue(p, "form_fields[celular]") ??
    getNestedValue(p, "form_fields[tel]") ??
    getNestedValue(p, "form_fields[mobile]") ??
    getNestedValue(p, "form_fields[your-tel]") ??
    getNestedValue(p, "form_fields[your_phone]") ??
    getNestedValue(p, "form_fields.phone") ??
    getNestedValue(p, "form_fields.telefone") ??
    getNestedValue(p, "form_fields.whatsapp") ??
    getNestedValue(p, "form_fields.celular") ??
    getNestedValue(p, "fields[phone]") ??
    getNestedValue(p, "fields[telefone]") ??
    getNestedValue(p, "fields[whatsapp]") ??
    getNestedValue(p, "fields.phone") ??
    getNestedValue(p, "fields.telefone") ??
    getNestedValue(p, "fields.whatsapp") ??
    getNestedValue(p, "data.phone") ??
    getNestedValue(p, "data.telefone") ??
    getNestedValue(p, "data.whatsapp") ??
    getNestedValue(p, "your-tel") ??
    getNestedValue(p, "your_phone") ??
    getNestedValue(p, "phone") ??
    getNestedValue(p, "telefone") ??
    getNestedValue(p, "whatsapp") ??
    getNestedValue(p, "celular") ??
    getNestedValue(p, "mobile") ??
    getNestedValue(p, "tel") ??
    getNestedValue(p, "phone_number") ??
    getNestedValue(p, "numero") ??
    getNestedValue(p, "contact_phone");

  // 3. Extração do E-mail
  const rawEmail =
    m.email ??
    getNestedValue(p, "form_fields[email]") ??
    getNestedValue(p, "form_fields[e-mail]") ??
    getNestedValue(p, "form_fields[mail]") ??
    getNestedValue(p, "form_fields[your-email]") ??
    getNestedValue(p, "form_fields[your_email]") ??
    getNestedValue(p, "form_fields.email") ??
    getNestedValue(p, "form_fields.e-mail") ??
    getNestedValue(p, "form_fields.mail") ??
    getNestedValue(p, "fields[email]") ??
    getNestedValue(p, "fields[mail]") ??
    getNestedValue(p, "fields.email") ??
    getNestedValue(p, "fields.mail") ??
    getNestedValue(p, "data.email") ??
    getNestedValue(p, "your-email") ??
    getNestedValue(p, "your_email") ??
    getNestedValue(p, "email") ??
    getNestedValue(p, "e-mail") ??
    getNestedValue(p, "mail") ??
    getNestedValue(p, "contact_email");

  const nameStr = rawName != null && String(rawName).trim() ? String(rawName).trim() : "—";
  const phoneStr = rawPhone != null && String(rawPhone).trim() ? String(rawPhone).trim() : "—";
  const emailStr = rawEmail != null && String(rawEmail).trim() ? String(rawEmail).trim() : "—";

  return {
    name: nameStr,
    phone: phoneStr,
    email: emailStr,
  };
}

