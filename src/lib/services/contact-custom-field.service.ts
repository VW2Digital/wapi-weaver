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

/**
 * Lê todos os valores canônicos de campos personalizados de um contato.
 */
export async function getContactFieldValues(
  tenantId: string,
  contactId: string,
): Promise<Record<string, unknown>> {
  const rows = (await db.query(
    `SELECT cf.key, cf.type, cfv.value, cfv.value_json
     FROM contact_custom_field_values cfv
     JOIN contact_custom_fields cf ON cf.id = cfv.custom_field_id
     JOIN contacts c ON c.id = cfv.contact_id AND c.user_id = cfv.user_id
     WHERE cfv.user_id = ? AND cfv.contact_id = ? AND cf.user_id = ?`,
    [tenantId, contactId, tenantId],
  )) as Array<{ key: string; type: string; value: string | null; value_json: unknown }>;

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
