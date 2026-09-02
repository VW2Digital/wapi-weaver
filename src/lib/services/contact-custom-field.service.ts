import db from "../db.js";

export interface CustomFieldDefinition {
  id: string;
  user_id: string;
  tenant_id: string;
  label: string;
  key: string;
  type: string;
  placeholder: string | null;
  options: string[] | null;
  default_value: string | null;
  required: number;
  show_on_form: number;
  show_on_table: number;
  show_on_details: number;
  is_active: number;
  sort_order: number;
}

export interface CustomFieldValueInput {
  custom_field_id?: string;
  key?: string;
  value: unknown;
}

export interface FieldValidationResult {
  ok: boolean;
  normalized?: unknown;
  storedValue?: string | null;
  storedJson?: string | null;
  remove?: boolean;
  error?: string;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

// Campos padrão do objeto contacts (colunas). Nunca devem ser tratados como
// custom fields no JSON nem ser escritos por provedores como metadados livres.
const STANDARD_CONTACT_FIELDS = new Set([
  "name",
  "company",
  "notes",
  "phone_e164",
  "whatsapp_number",
]);

// Chaves de metadados pertencentes a provedores/canais. Provider inbound pode
// escrevê-las, mas nunca quando houver uma definição de campo custom do tenant
// com a mesma chave.
// `email` e `phone` também são colunas do contato, mas são aceitos no JSON
// quando vêm de contextos de provedor (ex: prechat WebChat) e não colidem
// com uma definição custom do tenant.
const PROVIDER_METADATA_KEYS = new Set([
  "avatar_url",
  "wa_id",
  "source",
  "email",
  "phone",
  "phone_number_id",
  "display_phone_number",
  "instagram_username",
  "instagram_profile_name",
  "messenger_id",
  "facebook_id",
  "webchat_external_id",
  "wc_visitor_id",
]);

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

export function isStandardField(key: string): boolean {
  return STANDARD_CONTACT_FIELDS.has(key);
}

export function isProviderMetadataKey(key: string): boolean {
  return PROVIDER_METADATA_KEYS.has(key);
}

export async function getTenantCustomFieldKeys(tenantId: string): Promise<Set<string>> {
  const defs = (await db.query(
    "SELECT `key` FROM contact_custom_fields WHERE user_id = ? OR tenant_id = ?",
    [tenantId, tenantId],
  )) as Array<{ key: string }>;
  return new Set(defs.map((d) => d.key));
}

/**
 * Filtra um payload de metadados de provedor, garantindo que:
 * - chaves proibidas sejam descartadas;
 * - campos padrão do contato (colunas) sejam ignorados;
 * - campos customizados do tenant nunca sejam sobrescritos por um provedor;
 * - apenas chaves de metadados de provedor sejam mantidas;
 * - valores nulos de metadados de provedor sejam mantidos (para remoção de
 *   avatar, etc.), desde que a chave não seja um campo customizado do tenant.
 */
export function sanitizeProviderMetadata(
  tenantKeys: Set<string>,
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (isForbiddenKey(k)) continue;
    if (isStandardField(k)) continue;
    if (tenantKeys.has(k)) continue;
    if (!isProviderMetadataKey(k)) continue;
    // Mantém null para permitir remoção de metadados do provedor, mas nunca
    // de campos do tenant (filtrado acima).
    out[k] = v ?? null;
  }
  return out;
}

function parseJsonOrEmpty(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(value as string) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseOptions(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function validateCustomFieldValue(
  def: CustomFieldDefinition,
  value: unknown,
): FieldValidationResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, remove: true };
  }

  const type = def.type;

  if (FORBIDDEN_KEYS.has(def.key)) {
    return { ok: false, error: "Chave de campo inválida" };
  }

  switch (type) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "url":
    case "select": {
      if (typeof value !== "string") {
        return { ok: false, error: `Campo ${def.label} deve ser texto` };
      }
      if (type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { ok: false, error: `Campo ${def.label} deve ser um e-mail válido` };
      }
      if (type === "select") {
        const opts = parseOptions(def.options);
        if (opts.length > 0 && !opts.includes(value)) {
          return { ok: false, error: `Valor inválido para ${def.label}` };
        }
      }
      return { ok: true, normalized: value, storedValue: value };
    }

    case "number":
    case "currency": {
      const raw = String(value).trim();
      if (!raw) return { ok: true, remove: true };
      // Aceita tanto "1234.56" quanto "1.234,56" (formato BR) ou "1234,56"
      let normalized = raw;
      if (normalized.includes(",")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      }
      const num = Number(normalized);
      if (Number.isNaN(num)) {
        return { ok: false, error: `Campo ${def.label} deve ser um número válido` };
      }
      return { ok: true, normalized: num, storedValue: String(num) };
    }

    case "boolean": {
      if (value === true || value === "true" || value === 1 || value === "1") {
        return { ok: true, normalized: "true", storedValue: "true" };
      }
      if (value === false || value === "false" || value === 0 || value === "0") {
        return { ok: true, normalized: "false", storedValue: "false" };
      }
      return { ok: false, error: `Campo ${def.label} deve ser verdadeiro ou falso` };
    }

    case "date":
    case "datetime": {
      if (typeof value !== "string") {
        return { ok: false, error: `Campo ${def.label} deve ser uma data` };
      }
      if (Number.isNaN(Date.parse(value))) {
        return { ok: false, error: `Campo ${def.label} contém uma data inválida` };
      }
      return { ok: true, normalized: value, storedValue: value };
    }

    case "multi_select": {
      if (!Array.isArray(value)) {
        return { ok: false, error: `Campo ${def.label} deve ser uma lista` };
      }
      const arr = value.filter((v) => typeof v === "string");
      const opts = parseOptions(def.options);
      if (opts.length > 0) {
        for (const v of arr) {
          if (!opts.includes(v)) {
            return { ok: false, error: `Valor inválido para ${def.label}` };
          }
        }
      }
      return { ok: true, normalized: arr, storedValue: null, storedJson: JSON.stringify(arr) };
    }

    default:
      return { ok: false, error: `Tipo de campo ${type} não suportado` };
  }
}

function buildDefinitionQuery(
  tenantId: string,
  ids: string[],
  keys: string[],
): { sql: string; params: unknown[] } {
  const idPlaceholders = ids.map(() => "?").join(",");
  const keyPlaceholders = keys.map(() => "?").join(",");

  const conditions: string[] = [];
  const params: unknown[] = [tenantId];

  if (ids.length > 0) {
    conditions.push(`id IN (${idPlaceholders})`);
    params.push(...ids);
  }
  if (keys.length > 0) {
    conditions.push(`\`key\` IN (${keyPlaceholders})`);
    params.push(...keys);
  }

  const sql = `SELECT * FROM contact_custom_fields WHERE user_id = ? AND (${conditions.join(" OR ")})`;
  return { sql, params };
}

function resolveDefinition(
  input: CustomFieldValueInput,
  byId: Map<string, CustomFieldDefinition>,
  byKey: Map<string, CustomFieldDefinition>,
): CustomFieldDefinition | null {
  if (input.custom_field_id) return byId.get(input.custom_field_id) ?? null;
  if (input.key) return byKey.get(input.key) ?? null;
  return null;
}

/**
 * Salva valores de campos personalizados de forma canônica.
 *
 * - Valida ownership do tenant para contato e definição.
 * - Valida tipo e opções.
 * - Atualiza apenas os campos enviados (partial update).
 * - Valor nulo/vazio remove o valor do contato.
 * - Mantém contacts.custom_fields em sincronia como cache legado.
 */
export async function setContactFieldValues(
  tenantId: string,
  contactId: string,
  values: CustomFieldValueInput[],
): Promise<Record<string, unknown>> {
  if (!tenantId || !contactId) {
    throw new Error("tenantId e contactId são obrigatórios");
  }
  if (!Array.isArray(values)) {
    throw new Error("values deve ser um array");
  }

  return db.transaction(async (conn) => {
    // Lock do contato e leitura do JSON atual
    const [contactRows] = (await conn.query(
      "SELECT id, custom_fields FROM contacts WHERE id = ? AND user_id = ? FOR UPDATE",
      [contactId, tenantId],
    )) as [Array<{ id: string; custom_fields: unknown }>, unknown];
    if (!contactRows?.[0]) {
      throw new Error("Contato não encontrado");
    }

    const existingCustomFields = parseJsonOrEmpty(contactRows[0].custom_fields);

    const ids = values.map((v) => v.custom_field_id).filter((v): v is string => !!v);
    const keys = values.map((v) => v.key).filter((v): v is string => !!v && !v.includes("__"));

    const { sql: defSql, params: defParams } = buildDefinitionQuery(tenantId, ids, keys);
    const [definitionRows] = (await conn.query(defSql, defParams)) as [
      CustomFieldDefinition[],
      unknown,
    ];
    const byId = new Map<string, CustomFieldDefinition>();
    const byKey = new Map<string, CustomFieldDefinition>();
    for (const def of definitionRows) {
      byId.set(def.id, def);
      byKey.set(def.key, def);
    }

    const jsonPatch: Record<string, unknown> = {};
    const keysToRemove: string[] = [];

    for (const input of values) {
      const def = resolveDefinition(input, byId, byKey);
      if (!def) {
        throw new Error(`Definição de campo não encontrada: ${input.custom_field_id || input.key}`);
      }

      const validation = validateCustomFieldValue(def, input.value);
      if (!validation.ok) {
        throw new Error(validation.error || `Valor inválido para ${def.label}`);
      }

      if (validation.remove) {
        await conn.query(
          "DELETE FROM contact_custom_field_values WHERE user_id = ? AND contact_id = ? AND custom_field_id = ?",
          [tenantId, contactId, def.id],
        );
        keysToRemove.push(def.key);
        delete existingCustomFields[def.key];
      } else {
        await conn.query(
          `INSERT INTO contact_custom_field_values (user_id, contact_id, custom_field_id, value, value_json)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value), value_json = VALUES(value_json)`,
          [
            tenantId,
            contactId,
            def.id,
            validation.storedValue ?? null,
            validation.storedJson ?? null,
          ],
        );
        jsonPatch[def.key] = validation.normalized;
        existingCustomFields[def.key] = validation.normalized!;
      }
    }

    for (const k of keysToRemove) {
      delete existingCustomFields[k];
    }

    // Sincroniza contacts.custom_fields com os valores canônicos, preservando
    // chaves que não são campos personalizados (ex: avatar_url, wa_id).
    const mergedJson = { ...existingCustomFields, ...jsonPatch };
    for (const k of keysToRemove) {
      delete mergedJson[k];
    }

    await conn.query("UPDATE contacts SET custom_fields = ? WHERE id = ? AND user_id = ?", [
      JSON.stringify(mergedJson),
      contactId,
      tenantId,
    ]);

    return mergedJson;
  });
}

function coerceJsonValue(type: string, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  switch (type) {
    case "boolean":
      return value === true || value === "true" || value === 1 || value === "1";
    case "number":
    case "currency":
      return typeof value === "number"
        ? value
        : Number(String(value).replace(/\./g, "").replace(",", "."));
    case "multi_select":
      return Array.isArray(value) ? value : [];
    default:
      return value;
  }
}

/**
 * Lê todos os valores canônicos de campos personalizados de um contato.
 *
 * Valores canônicos em `contact_custom_field_values` têm precedência absoluta.
 * Se um campo possui definição canônica mas ainda não foi migrado da coluna
 * `contacts.custom_fields`, o JSON legado é usado como fallback de leitura
 * apenas para chaves com definição correspondente no mesmo tenant.
 */
export async function getContactFieldValues(
  tenantId: string,
  contactId: string,
): Promise<Record<string, unknown>> {
  const [rows, contactRow, defs] = await Promise.all([
    db.query(
      `SELECT cf.key, cf.type, cfv.value, cfv.value_json
       FROM contact_custom_field_values cfv
       JOIN contact_custom_fields cf ON cf.id = cfv.custom_field_id
       JOIN contacts c ON c.id = cfv.contact_id AND c.user_id = cfv.user_id
       WHERE cfv.user_id = ? AND cfv.contact_id = ? AND cf.user_id = ?`,
      [tenantId, contactId, tenantId],
    ) as Promise<Array<{ key: string; type: string; value: string | null; value_json: unknown }>>,
    db.query("SELECT custom_fields FROM contacts WHERE id = ? AND user_id = ?", [
      contactId,
      tenantId,
    ]) as Promise<Array<{ custom_fields: string | Record<string, unknown> | null }>>,
    getFieldDefinitions(tenantId),
  ]);

  const result: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.value_json != null) {
      result[r.key] = typeof r.value_json === "string" ? JSON.parse(r.value_json) : r.value_json;
    } else if (r.type === "boolean") {
      result[r.key] = r.value === "true";
    } else if (r.type === "number" || r.type === "currency") {
      result[r.key] = r.value == null ? null : Number(r.value);
    } else {
      result[r.key] = r.value;
    }
  }

  // Fallback para dados legados ainda não sincronizados: se a chave existe no
  // JSON e possui definição canônica, retorna o valor do JSON (canônico vence
  // quando presente).
  if (contactRow?.[0]?.custom_fields) {
    const json = parseJsonOrEmpty(contactRow[0].custom_fields);
    const defsByKey = new Map(defs.map((d) => [d.key, d]));
    for (const [key, value] of Object.entries(json)) {
      if (result[key] !== undefined || isForbiddenKey(key)) continue;
      const def = defsByKey.get(key);
      if (!def) continue;
      const coerced = coerceJsonValue(def.type, value);
      if (coerced !== null) {
        result[key] = coerced;
      }
    }
  }

  return result;
}

/**
 * Lê valores canônicos para múltiplos contatos de uma vez.
 * Retorna linhas no formato compatível com getCustomFieldValuesBatch.
 */
export async function getContactFieldValuesBatch(
  tenantId: string,
  contactIds: string[],
): Promise<
  Array<{
    contact_id: string;
    custom_field_id: string;
    key: string;
    label: string;
    type: string;
    value: string | number | boolean | string[] | null;
    value_json: string | number | boolean | string[] | null;
  }>
> {
  if (contactIds.length === 0) return [];

  const placeholders = contactIds.map(() => "?").join(",");
  const rows = (await db.query(
    `SELECT cfv.contact_id, cf.id as custom_field_id, cf.key, cf.label, cf.type, cfv.value, cfv.value_json
     FROM contact_custom_field_values cfv
     JOIN contact_custom_fields cf ON cf.id = cfv.custom_field_id
     JOIN contacts c ON c.id = cfv.contact_id AND c.user_id = cfv.user_id
     WHERE cfv.user_id = ? AND cfv.contact_id IN (${placeholders}) AND cf.user_id = ?`,
    [tenantId, ...contactIds, tenantId],
  )) as Array<{
    contact_id: string;
    custom_field_id: string;
    key: string;
    label: string;
    type: string;
    value: string | null;
    value_json: unknown;
  }>;

  return rows.map((r) => {
    let parsedValue: string | number | boolean | string[] | null = r.value;
    if (r.value_json != null) {
      parsedValue =
        typeof r.value_json === "string"
          ? (JSON.parse(r.value_json) as string | number | boolean | string[] | null)
          : (r.value_json as string | number | boolean | string[] | null);
    } else if (r.type === "boolean") {
      parsedValue = r.value === "true";
    } else if (r.type === "number" || r.type === "currency") {
      parsedValue = r.value == null ? null : Number(r.value);
    }
    return { ...r, value: parsedValue, value_json: null };
  });
}

/**
 * Sincroniza valores presentes em contacts.custom_fields (cache legado) com a
 * tabela canônica contact_custom_field_values.
 *
 * Útil para callers que ainda enviam custom_fields como JSON.
 */
export async function syncContactFieldValuesFromJson(
  tenantId: string,
  contactId: string,
  customFieldsJson: Record<string, unknown> | null | undefined,
): Promise<void> {
  if (!customFieldsJson || typeof customFieldsJson !== "object") return;

  const keys = Object.keys(customFieldsJson).filter((k) => !FORBIDDEN_KEYS.has(k));
  if (keys.length === 0) return;

  const { sql: defSql, params: defParams } = buildDefinitionQuery(tenantId, [], keys);
  const definitionRows = (await db.query(defSql, defParams)) as CustomFieldDefinition[];
  const byKey = new Map<string, CustomFieldDefinition>();
  for (const def of definitionRows) {
    byKey.set(def.key, def);
  }

  const inputs: CustomFieldValueInput[] = [];
  for (const [key, value] of Object.entries(customFieldsJson)) {
    if (byKey.has(key)) {
      inputs.push({ key, value });
    }
  }

  if (inputs.length > 0) {
    await setContactFieldValues(tenantId, contactId, inputs);
  }
}

/**
 * Retorna definições de campos personalizados do tenant.
 */
export async function getFieldDefinitions(tenantId: string): Promise<CustomFieldDefinition[]> {
  return (await db.query(
    "SELECT * FROM contact_custom_fields WHERE user_id = ? OR tenant_id = ? ORDER BY sort_order ASC, created_at ASC",
    [tenantId, tenantId],
  )) as CustomFieldDefinition[];
}
